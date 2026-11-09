using EventManagement.Api.Common;
using EventManagement.Api.Contracts;

namespace EventManagement.Api.Services;

/// <summary>
/// Registration use cases for a given event. The rules (past events, duplicates, capacity) are enforced by the
/// <see cref="Domain.Event"/> aggregate; this service supplies the lookup, the clock and the mapping.
/// </summary>
public interface IRegistrationService
{
    /// <summary>Lists an event's registrations, oldest first.</summary>
    Result<IReadOnlyList<RegistrationResponse>> List(Guid eventId);

    /// <summary>Gets one registration of an event.</summary>
    Result<RegistrationResponse> GetById(Guid eventId, Guid registrationId);

    /// <summary>Registers an attendee for an event.</summary>
    Result<RegistrationResponse> Register(Guid eventId, CreateRegistrationRequest request);

    /// <summary>Cancels a registration, freeing its spot.</summary>
    Result Unregister(Guid eventId, Guid registrationId);
}
