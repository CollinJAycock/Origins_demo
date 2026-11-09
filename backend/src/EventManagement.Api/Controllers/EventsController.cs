using System.ComponentModel.DataAnnotations;
using EventManagement.Api.Contracts;
using EventManagement.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace EventManagement.Api.Controllers;

/// <summary>Create, read, update and delete events.</summary>
[Route("api/events")]
public sealed class EventsController(IEventService events) : ApiControllerBase
{
    /// <summary>Lists events, optionally filtered by status and search text, one page at a time.</summary>
    /// <remarks>
    /// Upcoming events are ordered soonest first, past events most recent first, and <c>all</c> chronologically.
    /// </remarks>
    /// <param name="status">Which events to include: <c>all</c>, <c>upcoming</c> or <c>past</c> (case-insensitive).</param>
    /// <param name="search">Text to look for in the title or description (case-insensitive, up to 100 characters).</param>
    /// <param name="page">The 1-based page number. A page past the end returns no items.</param>
    /// <param name="pageSize">How many events to return per page (1–100).</param>
    /// <response code="200">The requested page of events.</response>
    /// <response code="400">A query parameter is invalid or out of range.</response>
    [HttpGet]
    [ProducesJson<PagedResponse<EventResponse>>(StatusCodes.Status200OK)]
    [ProducesProblem(StatusCodes.Status400BadRequest)]
    public ActionResult<PagedResponse<EventResponse>> List(
        EventStatusFilter status = EventStatusFilter.All,
        [StringLength(EventListQuery.SearchMaxLength, ErrorMessage = "Search must be 100 characters or fewer.")]
        string? search = null,
        [Range(1, int.MaxValue, ErrorMessage = "Page must be 1 or greater.")]
        int page = 1,
        [Range(1, EventListQuery.MaxPageSize, ErrorMessage = "Page size must be between 1 and 100.")]
        int pageSize = EventListQuery.DefaultPageSize) =>
        events.List(new EventListQuery(status, search, page, pageSize));

    /// <summary>Gets an event.</summary>
    /// <param name="id">The event id.</param>
    /// <response code="200">The event.</response>
    /// <response code="404">The event does not exist (<c>event_not_found</c>).</response>
    [HttpGet("{id:guid}")]
    [ProducesJson<EventResponse>(StatusCodes.Status200OK)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    public ActionResult<EventResponse> GetById(Guid id)
    {
        var result = events.GetById(id);
        return result.IsSuccess ? Ok(result.Value) : Problem(result.Error);
    }

    /// <summary>Creates an event.</summary>
    /// <param name="request">The event to create. Its date must be in the future.</param>
    /// <response code="201">The created event. The <c>Location</c> header holds its URL.</response>
    /// <response code="400">The request is invalid, for example the date is not in the future.</response>
    /// <response code="413">The request body is larger than 32 KB (<c>payload_too_large</c>).</response>
    /// <response code="415">The request body is not JSON (<c>unsupported_media_type</c>).</response>
    [HttpPost]
    [ProducesJson<EventResponse>(StatusCodes.Status201Created)]
    [ProducesProblem(StatusCodes.Status400BadRequest)]
    [ProducesProblem(StatusCodes.Status413PayloadTooLarge)]
    [ProducesProblem(StatusCodes.Status415UnsupportedMediaType)]
    public ActionResult<EventResponse> Create(CreateEventRequest request)
    {
        var result = events.Create(request);
        return result.IsSuccess
            ? CreatedAtAction(nameof(GetById), new { id = result.Value.Id }, result.Value)
            : Problem(result.Error);
    }

    /// <summary>Replaces all editable fields of an event.</summary>
    /// <remarks>The new values are validated first, so invalid input gets a 400 even if the event has started.</remarks>
    /// <param name="id">The event id.</param>
    /// <param name="request">The new field values. The date must be in the future.</param>
    /// <response code="200">The updated event.</response>
    /// <response code="400">The request is invalid, for example the new date is not in the future.</response>
    /// <response code="404">The event does not exist (<c>event_not_found</c>).</response>
    /// <response code="409">
    /// The event has already started (<c>event_in_past</c>), or the new max capacity is lower than the number of
    /// registrations (<c>capacity_below_registrations</c>).
    /// </response>
    /// <response code="413">The request body is larger than 32 KB (<c>payload_too_large</c>).</response>
    /// <response code="415">The request body is not JSON (<c>unsupported_media_type</c>).</response>
    [HttpPut("{id:guid}")]
    [ProducesJson<EventResponse>(StatusCodes.Status200OK)]
    [ProducesProblem(StatusCodes.Status400BadRequest)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    [ProducesProblem(StatusCodes.Status409Conflict)]
    [ProducesProblem(StatusCodes.Status413PayloadTooLarge)]
    [ProducesProblem(StatusCodes.Status415UnsupportedMediaType)]
    public ActionResult<EventResponse> Update(Guid id, UpdateEventRequest request)
    {
        var result = events.Update(id, request);
        return result.IsSuccess ? Ok(result.Value) : Problem(result.Error);
    }

    /// <summary>Deletes an event together with its registrations. Allowed at any time.</summary>
    /// <param name="id">The event id.</param>
    /// <response code="204">The event was deleted.</response>
    /// <response code="404">The event does not exist (<c>event_not_found</c>).</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    public ActionResult Delete(Guid id)
    {
        var result = events.Delete(id);
        return result.IsSuccess ? NoContent() : Problem(result.Error);
    }
}
