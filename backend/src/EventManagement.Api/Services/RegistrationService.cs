using EventManagement.Api.Common;
using EventManagement.Api.Contracts;
using EventManagement.Api.Domain;
using EventManagement.Api.Persistence;

namespace EventManagement.Api.Services;

/// <inheritdoc />
public sealed class RegistrationService(IEventRepository repository, TimeProvider timeProvider) : IRegistrationService
{
    /// <inheritdoc />
    public Result<IReadOnlyList<RegistrationResponse>> List(Guid eventId)
    {
        if (repository.GetById(eventId) is not { } found)
        {
            return EventErrors.EventNotFound(eventId);
        }

        return Result<IReadOnlyList<RegistrationResponse>>.Success(
            [.. found.GetRegistrations().Select(registration => registration.ToResponse())]);
    }

    /// <inheritdoc />
    public Result<RegistrationResponse> GetById(Guid eventId, Guid registrationId)
    {
        if (repository.GetById(eventId) is not { } found)
        {
            return EventErrors.EventNotFound(eventId);
        }

        return found.FindRegistration(registrationId) is { } registration
            ? registration.ToResponse()
            : EventErrors.RegistrationNotFound(registrationId);
    }

    /// <inheritdoc />
    public Result<RegistrationResponse> Register(Guid eventId, CreateRegistrationRequest request)
    {
        if (repository.GetById(eventId) is not { } found)
        {
            return EventErrors.EventNotFound(eventId);
        }

        // Missing fields were already rejected by model validation; empty fallbacks fail domain validation.
        return found
            .Register(request.Name ?? string.Empty, request.Email ?? string.Empty, timeProvider.GetUtcNow())
            .Map(registration => registration.ToResponse());
    }

    /// <inheritdoc />
    public Result Unregister(Guid eventId, Guid registrationId) =>
        repository.GetById(eventId) is { } found
            ? found.Unregister(registrationId, timeProvider.GetUtcNow())
            : EventErrors.EventNotFound(eventId);
}
