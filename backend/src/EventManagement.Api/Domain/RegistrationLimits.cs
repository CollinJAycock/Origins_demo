namespace EventManagement.Api.Domain;

/// <summary>Field limits for registrations, shared by the domain rules and the request contracts.</summary>
public static class RegistrationLimits
{
    /// <summary>Maximum length of a trimmed attendee name.</summary>
    public const int NameMaxLength = 100;

    /// <summary>Maximum length of an email address (the practical limit from RFC 5321).</summary>
    public const int EmailMaxLength = 254;
}
