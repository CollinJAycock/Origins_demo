namespace EventManagement.Api.Domain;

/// <summary>
/// The machine-readable <c>code</c> values returned in problem responses. Clients branch on these, so they are
/// part of the public API contract.
/// </summary>
/// <remarks>
/// Problems the framework produces without reaching a controller (unknown route, unsupported media type, request
/// body over the size limit, unhandled exception, ...) carry a code derived from their HTTP status instead, such as
/// <c>not_found</c>, <c>method_not_allowed</c>, <c>unsupported_media_type</c>, <c>payload_too_large</c> or
/// <c>internal_server_error</c>.
/// </remarks>
public static class ErrorCodes
{
    /// <summary>The request failed validation; field messages are in <c>errors</c>.</summary>
    public const string ValidationFailed = "validation_failed";

    /// <summary>No event exists with the requested id.</summary>
    public const string EventNotFound = "event_not_found";

    /// <summary>No registration with the requested id exists for the event.</summary>
    public const string RegistrationNotFound = "registration_not_found";

    /// <summary>The event has started, so it and its registrations are locked.</summary>
    public const string EventInPast = "event_in_past";

    /// <summary>The event has no spots left.</summary>
    public const string EventFull = "event_full";

    /// <summary>The email address is already registered for the event.</summary>
    public const string AlreadyRegistered = "already_registered";

    /// <summary>The requested max capacity is lower than the number of existing registrations.</summary>
    public const string CapacityBelowRegistrations = "capacity_below_registrations";
}
