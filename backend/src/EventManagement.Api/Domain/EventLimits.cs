namespace EventManagement.Api.Domain;

/// <summary>Field limits for events, shared by the domain rules and the request contracts.</summary>
public static class EventLimits
{
    /// <summary>Maximum length of a trimmed title.</summary>
    public const int TitleMaxLength = 200;

    /// <summary>Maximum length of a trimmed description.</summary>
    public const int DescriptionMaxLength = 2000;

    /// <summary>Smallest allowed max capacity.</summary>
    public const int MinCapacity = 1;

    /// <summary>Largest allowed max capacity.</summary>
    public const int MaxCapacity = 10_000;
}
