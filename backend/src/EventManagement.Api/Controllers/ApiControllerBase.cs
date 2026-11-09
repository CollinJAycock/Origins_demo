using System.Net.Mime;
using EventManagement.Api.Common;
using EventManagement.Api.Infrastructure;
using Microsoft.AspNetCore.Mvc;

namespace EventManagement.Api.Controllers;

/// <summary>
/// Base class for the API controllers, and the one place where an expected <see cref="Error"/> becomes an HTTP
/// response. Problems are created through <see cref="ControllerBase.ProblemDetailsFactory"/>, so they follow the
/// same conventions (<c>traceId</c>, <c>code</c>) as the problems the framework generates.
/// </summary>
[ApiController]
[Consumes(MediaTypeNames.Application.Json)]
[RequestSizeLimit(MaxRequestBodySize)]
public abstract class ApiControllerBase : ControllerBase
{
    /// <summary>
    /// The largest request body accepted, in bytes; a larger one gets a 413 problem response. Real requests stay
    /// under about 14 KB even with every character escaped, while Kestrel's default limit of 30 MB would let a
    /// client make the server buffer megabytes before the field limits can reject them.
    /// </summary>
    public const int MaxRequestBodySize = 32 * 1024;

    /// <summary>Converts an expected failure into the matching RFC 9457 problem response.</summary>
    protected ActionResult Problem(Error error) => error.Type switch
    {
        ErrorType.Validation => ValidationProblemFor(error),
        ErrorType.NotFound => ProblemFor(StatusCodes.Status404NotFound, error),
        ErrorType.Conflict => ProblemFor(StatusCodes.Status409Conflict, error),
        _ => throw new ArgumentOutOfRangeException(nameof(error), error.Type, "Unknown error type."),
    };

    // Goes through the same factory as automatic model validation, so every 400 has the same shape. The domain
    // names fields after its properties ("MaxCapacity"); like every validation problem's keys, they are turned into
    // the JSON names clients know ("maxCapacity") by ProblemDetailsConventions.
    private ActionResult ValidationProblemFor(Error error)
    {
        foreach (var (field, messages) in error.FieldErrors)
        {
            foreach (var message in messages)
            {
                ModelState.AddModelError(field, message);
            }
        }

        return ValidationProblem();
    }

    private ObjectResult ProblemFor(int statusCode, Error error)
    {
        var problem = ProblemDetailsFactory.CreateProblemDetails(HttpContext, statusCode, detail: error.Message);
        problem.Extensions[ProblemDetailsConventions.CodeExtension] = error.Code;
        return new ObjectResult(problem) { StatusCode = statusCode };
    }
}
