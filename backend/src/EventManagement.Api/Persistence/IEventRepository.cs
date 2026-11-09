using EventManagement.Api.Domain;

namespace EventManagement.Api.Persistence;

/// <summary>
/// Stores event aggregates. The members are synchronous because the only implementation is in memory and
/// CPU-bound; a database-backed implementation would make them async and add an explicit save step.
/// </summary>
public interface IEventRepository
{
    /// <summary>Finds an event by id.</summary>
    /// <returns>The event, or <see langword="null"/> if there is none with that id.</returns>
    Event? GetById(Guid id);

    /// <summary>Returns every stored event, in no particular order.</summary>
    IReadOnlyList<Event> GetAll();

    /// <summary>Adds a new event.</summary>
    void Add(Event newEvent);

    /// <summary>
    /// Removes an event, and with it the registrations it owns. A caller that still holds the event can no longer
    /// change it.
    /// </summary>
    /// <returns><see langword="true"/> if the event existed.</returns>
    bool Remove(Guid id);
}
