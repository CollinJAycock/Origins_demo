using System.Diagnostics;
using System.Text.Json;
using EventManagement.Api.Domain;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.WebUtilities;

namespace EventManagement.Api.Infrastructure;

/// <summary>
/// Conventions applied to every problem details response, whichever component produced it: controllers, model
/// validation, status code pages or the exception handler.
/// </summary>
internal static class ProblemDetailsConventions
{
    /// <summary>The extension member carrying the machine-readable error code.</summary>
    public const string CodeExtension = "code";

    private const string TraceIdExtension = "traceId";

    // Wording for values of these fields that the JSON input formatter can't convert. The formatter's own messages
    // name serializer types, so they are withheld, and the framework's fallback is a vague "The input was not valid."
    private static readonly Dictionary<string, string> ConversionErrorMessages = new()
    {
        ["date"] = ValidationMessages.DateInvalid,
        ["maxCapacity"] = ValidationMessages.MaxCapacityInvalid,
    };

    /// <summary>Normalizes validation keys and makes sure the problem carries a <c>traceId</c> and a <c>code</c>.</summary>
    public static void Apply(ProblemDetailsContext context)
    {
        var problem = context.ProblemDetails;
        problem.Extensions.TryAdd(TraceIdExtension, Activity.Current?.Id ?? context.HttpContext.TraceIdentifier);

        if (problem is HttpValidationProblemDetails validation)
        {
            validation.Errors = NormalizeKeys(validation.Errors);
        }

        // Business errors set their own code afterwards. Problems the framework generates on its own (unknown
        // route, unsupported media type, unhandled exception, ...) get one derived from the status, so clients
        // can always switch on "code".
        problem.Extensions.TryAdd(
            CodeExtension,
            problem is HttpValidationProblemDetails ? ErrorCodes.ValidationFailed : CodeFromStatus(problem.Status));
    }

    /// <summary>
    /// Gives the JSON input formatter's conversion errors their field's own message, where it has one. Runs on the
    /// model state before a validation problem is built from it.
    /// </summary>
    public static void DescribeConversionErrors(ModelStateDictionary modelState)
    {
        foreach (var (key, entry) in modelState)
        {
            if (!ConversionErrorMessages.TryGetValue(FieldName(key), out var message))
            {
                continue;
            }

            for (var index = 0; index < entry.Errors.Count; index++)
            {
                // The formatter records the exception itself; validation errors carry only a message.
                if (entry.Errors[index].Exception is { } exception && !IsSyntaxError(exception))
                {
                    entry.Errors[index] = new ModelError(message);
                }
            }
        }
    }

    // Malformed JSON, such as a body cut off inside or right after this field's value, is keyed by the field the
    // reader was in, but the value itself may be fine: keep the generic message. The serializer wraps the reader's
    // own exception, itself a JsonException, while a value it can't convert has another cause or none.
    private static bool IsSyntaxError(Exception exception) => exception is JsonException { InnerException: JsonException };

    // Keys arrive as JSON paths from the input formatter's conversion errors ("$.maxCapacity", spelled as the
    // client sent it) and as property names from the domain's validation ("MaxCapacity"). Report both under the
    // camelCase field names of the JSON that clients send.
    private static Dictionary<string, string[]> NormalizeKeys(IDictionary<string, string[]> errors) =>
        errors
            .GroupBy(error => FieldName(error.Key))
            .ToDictionary(group => group.Key, group => group.SelectMany(error => error.Value).ToArray());

    // "$.MaxCapacity" -> "maxCapacity". Keys that aren't JSON paths ("maxCapacity", "page") are only camel-cased.
    private static string FieldName(string key) => JsonNamingPolicy.CamelCase.ConvertName(key.TrimStart('$').TrimStart('.'));

    // "Method Not Allowed" -> "method_not_allowed". Non-standard status codes have no reason phrase.
    private static string CodeFromStatus(int? status)
    {
        var reasonPhrase = ReasonPhrases.GetReasonPhrase(status ?? StatusCodes.Status500InternalServerError);
        return reasonPhrase.Length == 0 ? "error" : reasonPhrase.ToLowerInvariant().Replace(' ', '_');
    }
}
