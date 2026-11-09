using EventManagement.Api.Common;
using EventManagement.Api.Contracts;
using EventManagement.Api.Domain;
using EventManagement.Api.Persistence;

namespace EventManagement.Api.Services;

/// <inheritdoc />
public sealed class EventService(IEventRepository repository, TimeProvider timeProvider) : IEventService
{
    /// <inheritdoc />
    public PagedResponse<EventResponse> List(EventListQuery query)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(query.Page, 1);
        ArgumentOutOfRangeException.ThrowIfLessThan(query.PageSize, 1);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(query.PageSize, EventListQuery.MaxPageSize);

        var now = timeProvider.GetUtcNow();
        var search = query.Search.TrimToNull();

        // Snapshot every event once, so filtering, sorting and mapping all see the same state. Scanning the whole
        // store is fine in memory; a database-backed repository would push filtering and paging into the query.
        var matches = repository.GetAll()
            .Select(stored => stored.Snapshot())
            .Where(snapshot => MatchesStatus(snapshot, query.Status, now) && MatchesSearch(snapshot, search))
            .ToList();

        // long: (page - 1) * pageSize can overflow int for very large page numbers.
        var skip = (long)(query.Page - 1) * query.PageSize;
        IReadOnlyList<EventResponse> items = skip >= matches.Count
            ? []
            : [.. Order(matches, query.Status).Skip((int)skip).Take(query.PageSize).Select(snapshot => snapshot.ToResponse(now))];

        return new PagedResponse<EventResponse>(items, query.Page, query.PageSize, matches.Count);
    }

    /// <inheritdoc />
    public Result<EventResponse> GetById(Guid id) =>
        repository.GetById(id) is { } found
            ? found.Snapshot().ToResponse(timeProvider.GetUtcNow())
            : EventErrors.EventNotFound(id);

    /// <inheritdoc />
    public Result<EventResponse> Create(CreateEventRequest request)
    {
        var now = timeProvider.GetUtcNow();
        var created = Event.Create(request.ToDetails(), now);
        if (!created.IsSuccess)
        {
            return created.Error;
        }

        repository.Add(created.Value);
        return created.Value.Snapshot().ToResponse(now);
    }

    /// <inheritdoc />
    public Result<EventResponse> Update(Guid id, UpdateEventRequest request)
    {
        if (repository.GetById(id) is not { } existing)
        {
            return EventErrors.EventNotFound(id);
        }

        var now = timeProvider.GetUtcNow();
        return existing.Update(request.ToDetails(), now).Map(snapshot => snapshot.ToResponse(now));
    }

    /// <inheritdoc />
    public Result Delete(Guid id) =>
        repository.Remove(id) ? Result.Success() : EventErrors.EventNotFound(id);

    private static bool MatchesStatus(EventSnapshot snapshot, EventStatusFilter status, DateTimeOffset now) => status switch
    {
        EventStatusFilter.All => true,
        EventStatusFilter.Upcoming => !snapshot.HasStarted(now),
        EventStatusFilter.Past => snapshot.HasStarted(now),
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unknown status filter."),
    };

    private static bool MatchesSearch(EventSnapshot snapshot, string? search) =>
        search is null
        || snapshot.Title.Contains(search, StringComparison.OrdinalIgnoreCase)
        || (snapshot.Description?.Contains(search, StringComparison.OrdinalIgnoreCase) ?? false);

    // Past events read best most recent first; otherwise chronological. Ties are broken by title, then id, so the
    // order is total and paging is stable.
    private static IOrderedEnumerable<EventSnapshot> Order(IEnumerable<EventSnapshot> snapshots, EventStatusFilter status)
    {
        var byDate = status == EventStatusFilter.Past
            ? snapshots.OrderByDescending(snapshot => snapshot.Date)
            : snapshots.OrderBy(snapshot => snapshot.Date);

        return byDate
            .ThenBy(snapshot => snapshot.Title, StringComparer.OrdinalIgnoreCase)
            .ThenBy(snapshot => snapshot.Id);
    }
}
