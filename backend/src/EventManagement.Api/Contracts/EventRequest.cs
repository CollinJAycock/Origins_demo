using System.ComponentModel.DataAnnotations;
using EventManagement.Api.Common;
using EventManagement.Api.Domain;

namespace EventManagement.Api.Contracts;

/// <summary>
/// The event fields a client supplies when creating or replacing an event. Text is trimmed as it is bound, so
/// the length limits apply to the trimmed value. Properties are nullable so that a missing field is reported
/// as a validation error instead of silently becoming a default value.
/// </summary>
public abstract record EventRequest
{
    /// <summary>The event title (1–200 characters, on one line).</summary>
    /// <example>Intro to ASP.NET Core</example>
    [Required(ErrorMessage = ValidationMessages.TitleRequired)]
    [VisibleText(ErrorMessage = ValidationMessages.TitleRequired)]
    [StringLength(EventLimits.TitleMaxLength, MinimumLength = 1, ErrorMessage = ValidationMessages.TitleTooLong)]
    [NoControlCharacters(ErrorMessage = ValidationMessages.TitleInvalidCharacters)]
    public string? Title { get; init => field = value.TrimToNull(); }

    /// <summary>
    /// An optional description (up to 2,000 characters; line breaks and tabs are allowed). A blank description is
    /// stored as null.
    /// </summary>
    /// <example>A hands-on introduction to building web APIs with ASP.NET Core.</example>
    [StringLength(EventLimits.DescriptionMaxLength, ErrorMessage = ValidationMessages.DescriptionTooLong)]
    [NoControlCharacters(Multiline = true, ErrorMessage = ValidationMessages.DescriptionInvalidCharacters)]
    public string? Description { get; init => field = value.TrimToNull(); }

    /// <summary>
    /// When the event starts: an ISO 8601 date-time with an offset (for example <c>Z</c> or <c>+01:00</c>), which must
    /// be in the future. Values without an offset are rejected. Stored in UTC.
    /// </summary>
    /// <example>2030-11-15T18:00:00Z</example>
    [Required(ErrorMessage = ValidationMessages.DateRequired)]
    public DateTimeOffset? Date { get; init; }

    /// <summary>How many attendees can register (1–10,000).</summary>
    /// <example>30</example>
    [Required(ErrorMessage = ValidationMessages.MaxCapacityRequired)]
    [Range(EventLimits.MinCapacity, EventLimits.MaxCapacity, ErrorMessage = ValidationMessages.MaxCapacityOutOfRange)]
    public int? MaxCapacity { get; init; }
}
