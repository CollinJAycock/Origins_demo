using System.Collections.ObjectModel;

namespace EventManagement.Api.Common;

/// <summary>The category of an expected failure; decides how it is reported to API clients.</summary>
public enum ErrorType
{
    /// <summary>The input is invalid; see <see cref="Error.FieldErrors"/>.</summary>
    Validation,

    /// <summary>A requested resource does not exist.</summary>
    NotFound,

    /// <summary>The request is valid but conflicts with the current state of a resource.</summary>
    Conflict,
}

/// <summary>
/// An expected business failure. Returned as a value (inside a <see cref="Result"/>) rather than thrown,
/// so callers handle it explicitly and exceptions stay reserved for bugs.
/// </summary>
/// <param name="Type">The failure category.</param>
/// <param name="Code">A stable, machine-readable code (snake_case) that clients can switch on.</param>
/// <param name="Message">A human-readable explanation suitable for showing to an end user.</param>
public sealed record Error(ErrorType Type, string Code, string Message)
{
    /// <summary>
    /// Validation messages keyed by the name of the invalid field. Empty unless <see cref="Type"/> is
    /// <see cref="ErrorType.Validation"/>.
    /// </summary>
    public IReadOnlyDictionary<string, string[]> FieldErrors { get; private init; } = ReadOnlyDictionary<string, string[]>.Empty;

    /// <summary>Creates a <see cref="ErrorType.NotFound"/> error.</summary>
    public static Error NotFound(string code, string message) => new(ErrorType.NotFound, code, message);

    /// <summary>Creates a <see cref="ErrorType.Conflict"/> error.</summary>
    public static Error Conflict(string code, string message) => new(ErrorType.Conflict, code, message);

    /// <summary>Creates a <see cref="ErrorType.Validation"/> error carrying per-field messages.</summary>
    public static Error Validation(string code, string message, IReadOnlyDictionary<string, string[]> fieldErrors) =>
        new(ErrorType.Validation, code, message) { FieldErrors = fieldErrors };
}
