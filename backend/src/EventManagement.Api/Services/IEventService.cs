using EventManagement.Api.Common;
using EventManagement.Api.Contracts;

namespace EventManagement.Api.Services;

/// <summary>
/// Event use cases. Orchestrates lookups, the clock, persistence and mapping; the business rules themselves live
/// in the <see cref="Domain.Event"/> aggregate. Synchronous because storage is in memory.
/// </summary>
public interface IEventService
{
    /// <summary>Lists the events matching <paramref name="query"/>, one page at a time.</summary>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The page is below 1 or the page size is outside 1..<see cref="EventListQuery.MaxPageSize"/>. The API validates
    /// both before calling, so this indicates a programming error.
    /// </exception>
    PagedResponse<EventResponse> List(EventListQuery query);

    /// <summary>Gets one event.</summary>
    Result<EventResponse> GetById(Guid id);

    /// <summary>Creates an event; its date must be in the future.</summary>
    Result<EventResponse> Create(CreateEventRequest request);

    /// <summary>Replaces the editable fields of an event that hasn't started yet.</summary>
    Result<EventResponse> Update(Guid id, UpdateEventRequest request);

    /// <summary>Deletes an event together with its registrations. Allowed at any time.</summary>
    Result Delete(Guid id);
}
