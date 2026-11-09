namespace EventManagement.Api.Contracts;

/// <summary>An attendee's registration for an event.</summary>
/// <param name="Id">The registration id.</param>
/// <param name="EventId">The id of the event registered for.</param>
/// <param name="Name">The attendee's name.</param>
/// <param name="Email">The attendee's email address, as entered.</param>
/// <param name="RegisteredAt">When the registration was made (UTC).</param>
public sealed record RegistrationResponse(Guid Id, Guid EventId, string Name, string Email, DateTimeOffset RegisteredAt);
