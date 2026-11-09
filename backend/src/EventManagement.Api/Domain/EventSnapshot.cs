namespace EventManagement.Api.Domain;

/// <summary>An immutable, internally consistent copy of an event's state, taken at a single instant.</summary>
/// <param name="Id">The event id.</param>
/// <param name="Title">The trimmed title.</param>
/// <param name="Description">The trimmed description, or <see langword="null"/>.</param>
/// <param name="Date">When the event starts (UTC).</param>
/// <param name="MaxCapacity">How many attendees can register.</param>
/// <param name="RegisteredCount">How many attendees are registered.</param>
/// <param name="CreatedAt">When the event was created.</param>
/// <param name="UpdatedAt">When the event's details last changed.</param>
public sealed record EventSnapshot(
    Guid Id,
    string Title,
    string? Description,
    DateTimeOffset Date,
    int MaxCapacity,
    int RegisteredCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt)
{
    /// <summary>Spots still free. Never negative: capacity can't drop below the registration count.</summary>
    public int AvailableSpots => MaxCapacity - RegisteredCount;

    /// <summary>Whether every spot is taken.</summary>
    public bool IsFull => RegisteredCount >= MaxCapacity;

    /// <summary>Whether the event has started (and is therefore past) at <paramref name="now"/>.</summary>
    public bool HasStarted(DateTimeOffset now) => Event.HasStarted(Date, now);
}
