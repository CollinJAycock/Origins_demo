using System.Net.Mime;
using Microsoft.AspNetCore.Mvc;

namespace EventManagement.Api.Controllers;

/// <summary>
/// Documents an RFC 9457 problem response with the media type it is really sent with,
/// <c>application/problem+json</c>. A 400 is documented as a validation problem: the only kind of 400 this API returns.
/// </summary>
[AttributeUsage(AttributeTargets.Method, AllowMultiple = true)]
internal sealed class ProducesProblemAttribute(int statusCode) : ProducesResponseTypeAttribute(
    statusCode == StatusCodes.Status400BadRequest ? typeof(ValidationProblemDetails) : typeof(ProblemDetails),
    statusCode,
    MediaTypeNames.Application.ProblemJson);
