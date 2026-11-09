namespace EventManagement.Api.Domain;

/// <summary>
/// User-facing validation messages. Constants so the request contracts' DataAnnotations and the domain's own
/// guards report identical wording; the numbers mirror <see cref="EventLimits"/> and <see cref="RegistrationLimits"/>.
/// </summary>
public static class ValidationMessages
{
    /// <summary>The title is missing or blank: nothing but whitespace or invisible characters.</summary>
    public const string TitleRequired = "Title is required.";

    /// <summary>The title exceeds <see cref="EventLimits.TitleMaxLength"/>.</summary>
    public const string TitleTooLong = "Title must be 200 characters or fewer.";

    /// <summary>The title contains a line break, tab or other control character.</summary>
    public const string TitleInvalidCharacters = "Title can't contain line breaks, tabs or other control characters.";

    /// <summary>The description exceeds <see cref="EventLimits.DescriptionMaxLength"/>.</summary>
    public const string DescriptionTooLong = "Description must be 2,000 characters or fewer.";

    /// <summary>The description contains a control character other than a line break or tab.</summary>
    public const string DescriptionInvalidCharacters =
        "Description can't contain control characters other than line breaks and tabs.";

    /// <summary>The event date is missing.</summary>
    public const string DateRequired = "Event date is required.";

    /// <summary>The event date is not a date-time with an offset, so the request body could not be read.</summary>
    public const string DateInvalid = "Event date must be a date and time with a UTC offset, such as 2030-11-15T18:00:00Z.";

    /// <summary>The event date is not after the current time.</summary>
    public const string DateNotInFuture = "Event date must be in the future.";

    /// <summary>The max capacity is missing.</summary>
    public const string MaxCapacityRequired = "Max capacity is required.";

    /// <summary>
    /// The max capacity is not a JSON integer, or is too large for one, so the request body could not be read.
    /// </summary>
    public const string MaxCapacityInvalid = "Max capacity must be a whole number between 1 and 10,000.";

    /// <summary>The max capacity is outside <see cref="EventLimits.MinCapacity"/>..<see cref="EventLimits.MaxCapacity"/>.</summary>
    public const string MaxCapacityOutOfRange = "Max capacity must be between 1 and 10,000.";

    /// <summary>The attendee name is missing or blank: nothing but whitespace or invisible characters.</summary>
    public const string NameRequired = "Name is required.";

    /// <summary>The attendee name exceeds <see cref="RegistrationLimits.NameMaxLength"/>.</summary>
    public const string NameTooLong = "Name must be 100 characters or fewer.";

    /// <summary>The attendee name contains a line break, tab or other control character.</summary>
    public const string NameInvalidCharacters = "Name can't contain line breaks, tabs or other control characters.";

    /// <summary>The email address is missing or blank.</summary>
    public const string EmailRequired = "Email is required.";

    /// <summary>The email address exceeds <see cref="RegistrationLimits.EmailMaxLength"/>.</summary>
    public const string EmailTooLong = "Email must be 254 characters or fewer.";

    /// <summary>The email address is not a valid address.</summary>
    public const string EmailInvalid = "Enter a valid email address.";
}
