namespace EventManagement.Api.Contracts;

/// <summary>An event together with its registration figures, as of the moment the response was built.</summary>
/// <param name="Id">The event id.</param>
/// <param name="Title">The event title.</param>
/// <param name="Description">The description, or null when there is none.</param>
/// <param name="Date">When the event starts (UTC).</param>
/// <param name="MaxCapacity">How many attendees can register.</param>
/// <param name="RegisteredCount">How many attendees are registered.</param>
/// <param name="AvailableSpots">How many spots are still free.</param>
/// <param name="IsFull">Whether every spot is taken.</param>
/// <param name="IsPast">Whether the event has started. Past events can't be edited and their registrations are locked.</param>
/// <param name="CreatedAt">When the event was created (UTC).</param>
/// <param name="UpdatedAt">When the event's details last changed (UTC).</param>
public sealed record EventResponse(
    Guid Id,
    string Title,
    string? Description,
    DateTimeOffset Date,
    int MaxCapacity,
    int RegisteredCount,
    int AvailableSpots,
    bool IsFull,
    bool IsPast,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
