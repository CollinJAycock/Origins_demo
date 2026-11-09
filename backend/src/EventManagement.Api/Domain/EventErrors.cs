using System.Globalization;
using EventManagement.Api.Common;

namespace EventManagement.Api.Domain;

/// <summary>The errors produced by the event aggregate and its application services, with their user-facing wording.</summary>
public static class EventErrors
{
    /// <summary>Registering is not possible because the event has started.</summary>
    public static readonly Error RegistrationClosed =
        Error.Conflict(ErrorCodes.EventInPast, "Registration is closed because this event has already started.");

    /// <summary>Editing is not possible because the event has started.</summary>
    public static readonly Error PastEventLocked =
        Error.Conflict(ErrorCodes.EventInPast, "Past events can't be edited.");

    /// <summary>Unregistering is not possible because the event has started.</summary>
    public static readonly Error PastRegistrationsLocked =
        Error.Conflict(ErrorCodes.EventInPast, "Registrations for past events can no longer be changed.");

    /// <summary>No event exists with the given id.</summary>
    public static Error EventNotFound(Guid eventId) =>
        Error.NotFound(ErrorCodes.EventNotFound, $"Event '{eventId}' was not found.");

    /// <summary>No registration with the given id exists for the event.</summary>
    public static Error RegistrationNotFound(Guid registrationId) =>
        Error.NotFound(ErrorCodes.RegistrationNotFound, $"Registration '{registrationId}' was not found for this event.");

    /// <summary>The event has no spots left.</summary>
    public static Error EventFull(int maxCapacity) =>
        Error.Conflict(ErrorCodes.EventFull, Format($"This event is full ({maxCapacity:N0} of {maxCapacity:N0} spots taken)."));

    /// <summary>The email address already holds a registration for the event.</summary>
    public static Error AlreadyRegistered(string email) =>
        Error.Conflict(ErrorCodes.AlreadyRegistered, $"{email} is already registered for this event.");

    /// <summary>The requested capacity would leave existing attendees without a spot.</summary>
    public static Error CapacityBelowRegistrations(int registeredCount) =>
        Error.Conflict(
            ErrorCodes.CapacityBelowRegistrations,
            Format($"Max capacity can't be lower than the current number of registrations ({registeredCount:N0})."));

    /// <summary>One or more fields are invalid; <paramref name="fieldErrors"/> is keyed by property name.</summary>
    public static Error Validation(IReadOnlyDictionary<string, string[]> fieldErrors) =>
        Error.Validation(ErrorCodes.ValidationFailed, "One or more validation errors occurred.", fieldErrors);

    // Messages are shown to users; format numbers the same way regardless of the server's culture.
    private static string Format(FormattableString message) => message.ToString(CultureInfo.InvariantCulture);
}
