using System.ComponentModel.DataAnnotations;
using EventManagement.Api.Common;
using EventManagement.Api.Domain;

namespace EventManagement.Api.Contracts;

/// <summary>The body of a request that registers an attendee for an event. Text is trimmed as it is bound.</summary>
public sealed record CreateRegistrationRequest
{
    /// <summary>The attendee's name (1–100 characters, on one line).</summary>
    /// <example>Ada Lovelace</example>
    [Required(ErrorMessage = ValidationMessages.NameRequired)]
    [VisibleText(ErrorMessage = ValidationMessages.NameRequired)]
    [StringLength(RegistrationLimits.NameMaxLength, MinimumLength = 1, ErrorMessage = ValidationMessages.NameTooLong)]
    [NoControlCharacters(ErrorMessage = ValidationMessages.NameInvalidCharacters)]
    public string? Name { get; init => field = value.TrimToNull(); }

    /// <summary>
    /// The attendee's email address, which identifies them: an address can be registered only once per event,
    /// ignoring letter case and whether an internationalized domain is written in Unicode or ASCII (punycode).
    /// </summary>
    /// <example>ada@example.com</example>
    [Required(ErrorMessage = ValidationMessages.EmailRequired)]
    [StringLength(RegistrationLimits.EmailMaxLength, MinimumLength = 1, ErrorMessage = ValidationMessages.EmailTooLong)]
    [AttendeeEmail(ErrorMessage = ValidationMessages.EmailInvalid)]
    public string? Email { get; init => field = value.TrimToNull(); }
}
