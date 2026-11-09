using EventManagement.Api.Common;

namespace EventManagement.Api.Domain;

/// <summary>The editable details of an event: everything a create or a full update supplies.</summary>
/// <param name="Title">The event title (required, up to <see cref="EventLimits.TitleMaxLength"/> characters).</param>
/// <param name="Description">An optional description (up to <see cref="EventLimits.DescriptionMaxLength"/> characters).</param>
/// <param name="Date">When the event starts.</param>
/// <param name="MaxCapacity">How many attendees can register.</param>
public sealed record EventDetails(string Title, string? Description, DateTimeOffset Date, int MaxCapacity)
{
    /// <summary>Returns the canonical form: trimmed text, a blank description as <see langword="null"/>, the date in UTC.</summary>
    internal EventDetails Normalize() =>
        new(Title.Trim(), Description.TrimToNull(), Date.ToUniversalTime(), MaxCapacity);

    /// <summary>Checks normalized details against the field rules, collecting every violation.</summary>
    internal Error? Validate(DateTimeOffset now)
    {
        Dictionary<string, string[]> errors = [];

        if (!TextRules.HasVisibleCharacter(Title))
        {
            errors[nameof(Title)] = [ValidationMessages.TitleRequired];
        }
        else if (Title.Length > EventLimits.TitleMaxLength)
        {
            errors[nameof(Title)] = [ValidationMessages.TitleTooLong];
        }
        else if (TextRules.HasControlCharacter(Title))
        {
            errors[nameof(Title)] = [ValidationMessages.TitleInvalidCharacters];
        }

        if (Description?.Length > EventLimits.DescriptionMaxLength)
        {
            errors[nameof(Description)] = [ValidationMessages.DescriptionTooLong];
        }
        else if (Description is not null && TextRules.HasControlCharacter(Description, multiline: true))
        {
            errors[nameof(Description)] = [ValidationMessages.DescriptionInvalidCharacters];
        }

        if (Event.HasStarted(Date, now))
        {
            errors[nameof(Date)] = [ValidationMessages.DateNotInFuture];
        }

        if (MaxCapacity is < EventLimits.MinCapacity or > EventLimits.MaxCapacity)
        {
            errors[nameof(MaxCapacity)] = [ValidationMessages.MaxCapacityOutOfRange];
        }

        return errors.Count == 0 ? null : EventErrors.Validation(errors);
    }
}
