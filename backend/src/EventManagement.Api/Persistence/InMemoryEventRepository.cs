using System.Collections.Concurrent;
using EventManagement.Api.Domain;

namespace EventManagement.Api.Persistence;

/// <summary>
/// Thread-safe in-memory event store, registered as a singleton. Events are live aggregates that guard their own
/// state, so changes made through their methods are visible immediately and need no save step; the dictionary
/// only has to make adding, finding and removing events safe.
/// </summary>
public sealed class InMemoryEventRepository : IEventRepository
{
    private readonly ConcurrentDictionary<Guid, Event> _events = new();

    /// <inheritdoc />
    public Event? GetById(Guid id) => _events.TryGetValue(id, out var found) ? found : null;

    /// <inheritdoc />
    /// <remarks>Enumerates the dictionary, which is lock-free; <c>Values</c> would briefly take every internal lock.</remarks>
    public IReadOnlyList<Event> GetAll() => [.. _events.Select(entry => entry.Value)];

    /// <inheritdoc />
    public void Add(Event newEvent)
    {
        if (!_events.TryAdd(newEvent.Id, newEvent))
        {
            throw new InvalidOperationException($"An event with id '{newEvent.Id}' already exists.");
        }
    }

    /// <inheritdoc />
    public bool Remove(Guid id) => _events.TryRemove(id, out _);
}
