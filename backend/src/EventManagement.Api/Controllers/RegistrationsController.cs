using EventManagement.Api.Contracts;
using EventManagement.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace EventManagement.Api.Controllers;

/// <summary>Register attendees for an event, list them, and cancel registrations.</summary>
[Route("api/events/{eventId:guid}/registrations")]
public sealed class RegistrationsController(IRegistrationService registrations) : ApiControllerBase
{
    /// <summary>Lists an event's registrations, oldest first.</summary>
    /// <param name="eventId">The event id.</param>
    /// <response code="200">The event's registrations.</response>
    /// <response code="404">The event does not exist (<c>event_not_found</c>).</response>
    [HttpGet]
    [ProducesJson<IReadOnlyList<RegistrationResponse>>(StatusCodes.Status200OK)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    public ActionResult<IReadOnlyList<RegistrationResponse>> List(Guid eventId)
    {
        var result = registrations.List(eventId);
        return result.IsSuccess ? Ok(result.Value) : Problem(result.Error);
    }

    /// <summary>Gets one of an event's registrations.</summary>
    /// <param name="eventId">The event id.</param>
    /// <param name="registrationId">The registration id.</param>
    /// <response code="200">The registration.</response>
    /// <response code="404">
    /// The event does not exist (<c>event_not_found</c>), or it has no registration with this id
    /// (<c>registration_not_found</c>).
    /// </response>
    [HttpGet("{registrationId:guid}")]
    [ProducesJson<RegistrationResponse>(StatusCodes.Status200OK)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    public ActionResult<RegistrationResponse> GetById(Guid eventId, Guid registrationId)
    {
        var result = registrations.GetById(eventId, registrationId);
        return result.IsSuccess ? Ok(result.Value) : Problem(result.Error);
    }

    /// <summary>Registers an attendee for an event.</summary>
    /// <remarks>
    /// The name and email address are validated first, so invalid input gets a 400 whatever the event's state. Then
    /// rules are checked in this order: the event must not have started, the email address must not already be
    /// registered (ignoring letter case and whether an internationalized domain is written in Unicode or punycode),
    /// and the event must have a free spot.
    /// </remarks>
    /// <param name="eventId">The event id.</param>
    /// <param name="request">The attendee's name and email address.</param>
    /// <response code="201">The new registration. The <c>Location</c> header holds its URL.</response>
    /// <response code="400">The name or email address is invalid.</response>
    /// <response code="404">The event does not exist (<c>event_not_found</c>).</response>
    /// <response code="409">
    /// The event has started (<c>event_in_past</c>), the email address is already registered
    /// (<c>already_registered</c>), or the event is full (<c>event_full</c>).
    /// </response>
    /// <response code="413">The request body is larger than 32 KB (<c>payload_too_large</c>).</response>
    /// <response code="415">The request body is not JSON (<c>unsupported_media_type</c>).</response>
    [HttpPost]
    [ProducesJson<RegistrationResponse>(StatusCodes.Status201Created)]
    [ProducesProblem(StatusCodes.Status400BadRequest)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    [ProducesProblem(StatusCodes.Status409Conflict)]
    [ProducesProblem(StatusCodes.Status413PayloadTooLarge)]
    [ProducesProblem(StatusCodes.Status415UnsupportedMediaType)]
    public ActionResult<RegistrationResponse> Register(Guid eventId, CreateRegistrationRequest request)
    {
        var result = registrations.Register(eventId, request);
        return result.IsSuccess
            ? CreatedAtAction(nameof(GetById), new { eventId, registrationId = result.Value.Id }, result.Value)
            : Problem(result.Error);
    }

    /// <summary>Cancels a registration, freeing its spot.</summary>
    /// <param name="eventId">The event id.</param>
    /// <param name="registrationId">The registration id.</param>
    /// <response code="204">The registration was cancelled.</response>
    /// <response code="404">
    /// The event does not exist (<c>event_not_found</c>), or it has no registration with this id
    /// (<c>registration_not_found</c>).
    /// </response>
    /// <response code="409">The event has started, so its registrations are locked (<c>event_in_past</c>).</response>
    [HttpDelete("{registrationId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    [ProducesProblem(StatusCodes.Status409Conflict)]
    public ActionResult Unregister(Guid eventId, Guid registrationId)
    {
        var result = registrations.Unregister(eventId, registrationId);
        return result.IsSuccess ? NoContent() : Problem(result.Error);
    }
}
