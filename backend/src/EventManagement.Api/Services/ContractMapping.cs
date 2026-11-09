using EventManagement.Api.Contracts;
using EventManagement.Api.Domain;

namespace EventManagement.Api.Services;

/// <summary>Conversions between the HTTP contracts and the domain model.</summary>
internal static class ContractMapping
{
    // Model validation ([ApiController]) rejects requests with missing fields before they reach a service. These
    // fallbacks only matter if a caller bypasses it; they then fail domain validation instead of being stored.
    public static EventDetails ToDetails(this EventRequest request) =>
        new(request.Title ?? string.Empty, request.Description, request.Date ?? default, request.MaxCapacity ?? 0);

    public static EventResponse ToResponse(this EventSnapshot snapshot, DateTimeOffset now) => new(
        snapshot.Id,
        snapshot.Title,
        snapshot.Description,
        snapshot.Date,
        snapshot.MaxCapacity,
        snapshot.RegisteredCount,
        snapshot.AvailableSpots,
        snapshot.IsFull,
        snapshot.HasStarted(now),
        snapshot.CreatedAt,
        snapshot.UpdatedAt);

    public static RegistrationResponse ToResponse(this Registration registration) => new(
        registration.Id,
        registration.EventId,
        registration.Name,
        registration.Email,
        registration.RegisteredAt);
}
