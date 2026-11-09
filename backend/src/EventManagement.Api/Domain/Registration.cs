using EventManagement.Api.Common;

namespace EventManagement.Api.Domain;

/// <summary>
/// An attendee's registration for an event. Immutable; registrations are added and removed only through the
/// owning <see cref="Event"/>, which enforces the rules about them.
/// </summary>
/// <param name="Id">The registration id.</param>
/// <param name="EventId">The id of the event registered for.</param>
/// <param name="Name">The attendee's trimmed name.</param>
/// <param name="Email">
/// The attendee's trimmed email address, as entered. It identifies the attendee, ignoring letter case and how an
/// internationalized domain is written.
/// </param>
/// <param name="RegisteredAt">When the registration was made.</param>
public sealed record Registration(Guid Id, Guid EventId, string Name, string Email, DateTimeOffset RegisteredAt)
{
    /// <summary>Checks a trimmed name and email against the field rules, collecting every violation.</summary>
    internal static Error? Validate(string name, string email)
    {
        Dictionary<string, string[]> errors = [];

        if (!TextRules.HasVisibleCharacter(name))
        {
            errors[nameof(Name)] = [ValidationMessages.NameRequired];
        }
        else if (name.Length > RegistrationLimits.NameMaxLength)
        {
            errors[nameof(Name)] = [ValidationMessages.NameTooLong];
        }
        else if (TextRules.HasControlCharacter(name))
        {
            errors[nameof(Name)] = [ValidationMessages.NameInvalidCharacters];
        }

        if (email.Length == 0)
        {
            errors[nameof(Email)] = [ValidationMessages.EmailRequired];
        }
        else if (email.Length > RegistrationLimits.EmailMaxLength)
        {
            errors[nameof(Email)] = [ValidationMessages.EmailTooLong];
        }
        else if (!EmailAddresses.IsValid(email))
        {
            errors[nameof(Email)] = [ValidationMessages.EmailInvalid];
        }

        return errors.Count == 0 ? null : EventErrors.Validation(errors);
    }
}
