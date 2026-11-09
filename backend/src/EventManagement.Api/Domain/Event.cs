using EventManagement.Api.Common;

namespace EventManagement.Api.Domain;

/// <summary>
/// The event aggregate. It owns its registrations and enforces every business rule about them. Methods take the
/// current time as a parameter, so the rules are pure and callers (services, tests, seed data) control the clock.
/// </summary>
public sealed class Event
{
    // Thread safety: one private lock per event guards its details and registrations together. Every rule that
    // checks state and then changes it (capacity, duplicate email, capacity vs. registrations) runs entirely
    // under the lock, and reads copy state out under the same lock, so no caller sees a torn view. Each event
    // has its own lock, so requests for different events never contend.
    private readonly Lock _gate = new();

    // Keyed by id for O(1) lookups and kept in RegisteredAt order for listing.
    private readonly OrderedDictionary<Guid, Registration> _registrations = [];

    // Attendees are identified by email address, compared by identity key so that every spelling of an address
    // (letter case, a Unicode or ASCII domain) is the same attendee: O(1) duplicate detection.
    private readonly HashSet<string> _attendeeKeys = [];

    private EventDetails _details;
    private DateTimeOffset _updatedAt;

    // Set when the event is removed from the store. A request that found the event just before can still hold it,
    // so every change checks this under the lock and fails as if the event had not been found.
    private bool _isDeleted;

    private Event(Guid id, EventDetails details, DateTimeOffset createdAt)
    {
        Id = id;
        CreatedAt = createdAt;
        _details = details;
        _updatedAt = createdAt;
    }

    /// <summary>The event id.</summary>
    public Guid Id { get; }

    /// <summary>When the event was created.</summary>
    public DateTimeOffset CreatedAt { get; }

    /// <summary>
    /// The definition of "past": an event starting at <paramref name="date"/> is past once it has started,
    /// i.e. when <paramref name="date"/> is at or before <paramref name="now"/>.
    /// </summary>
    public static bool HasStarted(DateTimeOffset date, DateTimeOffset now) => date <= now;

    /// <summary>Creates an event after normalizing and validating its details. The date must be in the future.</summary>
    public static Result<Event> Create(EventDetails details, DateTimeOffset now)
    {
        var normalized = details.Normalize();
        if (normalized.Validate(now) is { } error)
        {
            return error;
        }

        return new Event(Guid.CreateVersion7(now), normalized, now);
    }

    /// <summary>Returns a consistent copy of the event's current state.</summary>
    public EventSnapshot Snapshot()
    {
        lock (_gate)
        {
            return CreateSnapshot();
        }
    }

    /// <summary>
    /// Marks the event as deleted, so callers still holding it can no longer change it: updating, registering and
    /// unregistering then fail with <see cref="ErrorCodes.EventNotFound"/>. The store calls this when it removes the
    /// event.
    /// </summary>
    internal void MarkDeleted()
    {
        lock (_gate)
        {
            _isDeleted = true;
        }
    }

    /// <summary>
    /// Replaces the event's details. Checked in this order: the details must be valid (including a future date),
    /// the event must not have been deleted, the event must not have started (past events are locked), and the
    /// capacity can't drop below the current number of registrations.
    /// </summary>
    /// <returns>The event's state right after the update.</returns>
    public Result<EventSnapshot> Update(EventDetails details, DateTimeOffset now)
    {
        var normalized = details.Normalize();
        if (normalized.Validate(now) is { } validationError)
        {
            return validationError;
        }

        lock (_gate)
        {
            if (_isDeleted)
            {
                return EventErrors.EventNotFound(Id);
            }

            if (HasStarted(_details.Date, now))
            {
                return EventErrors.PastEventLocked;
            }

            if (normalized.MaxCapacity < _registrations.Count)
            {
                return EventErrors.CapacityBelowRegistrations(_registrations.Count);
            }

            _details = normalized;
            _updatedAt = now;
            return CreateSnapshot();
        }
    }

    /// <summary>
    /// Registers an attendee. Checks run in order of usefulness to the caller: the name and email must be valid,
    /// the event must not have been deleted or have started, the email must not already be registered, and a spot
    /// must be free.
    /// </summary>
    public Result<Registration> Register(string name, string email, DateTimeOffset now)
    {
        var trimmedName = name.Trim();
        var trimmedEmail = email.Trim();
        if (Registration.Validate(trimmedName, trimmedEmail) is { } validationError)
        {
            return validationError;
        }

        var attendeeKey = EmailAddresses.IdentityKey(trimmedEmail);

        lock (_gate)
        {
            if (_isDeleted)
            {
                return EventErrors.EventNotFound(Id);
            }

            if (HasStarted(_details.Date, now))
            {
                return EventErrors.RegistrationClosed;
            }

            if (_attendeeKeys.Contains(attendeeKey))
            {
                return EventErrors.AlreadyRegistered(trimmedEmail);
            }

            if (_registrations.Count >= _details.MaxCapacity)
            {
                return EventErrors.EventFull(_details.MaxCapacity);
            }

            var registration = new Registration(Guid.CreateVersion7(now), Id, trimmedName, trimmedEmail, now);
            InsertInOrder(registration);
            _attendeeKeys.Add(attendeeKey);
            return registration;
        }
    }

    /// <summary>Cancels one of this event's registrations, freeing its spot. Registrations of past events are locked.</summary>
    public Result Unregister(Guid registrationId, DateTimeOffset now)
    {
        lock (_gate)
        {
            if (_isDeleted)
            {
                return EventErrors.EventNotFound(Id);
            }

            if (!_registrations.TryGetValue(registrationId, out var registration))
            {
                return EventErrors.RegistrationNotFound(registrationId);
            }

            if (HasStarted(_details.Date, now))
            {
                return EventErrors.PastRegistrationsLocked;
            }

            _registrations.Remove(registrationId);
            _attendeeKeys.Remove(EmailAddresses.IdentityKey(registration.Email));
            return Result.Success();
        }
    }

    /// <summary>Finds one of this event's registrations by id.</summary>
    public Registration? FindRegistration(Guid registrationId)
    {
        lock (_gate)
        {
            return _registrations.TryGetValue(registrationId, out var registration) ? registration : null;
        }
    }

    /// <summary>Returns a copy of this event's registrations, oldest first.</summary>
    public IReadOnlyList<Registration> GetRegistrations()
    {
        lock (_gate)
        {
            return [.. _registrations.Values];
        }
    }

    // Caller must hold _gate.
    private EventSnapshot CreateSnapshot() => new(
        Id,
        _details.Title,
        _details.Description,
        _details.Date,
        _details.MaxCapacity,
        _registrations.Count,
        CreatedAt,
        _updatedAt);

    // Caller must hold _gate. Callers read the clock before taking the lock (and seed data passes historical
    // times), so a registration can arrive slightly out of order: walk back from the end to keep the order.
    // In practice the loop body never runs and this is an append.
    private void InsertInOrder(Registration registration)
    {
        var index = _registrations.Count;
        while (index > 0 && _registrations.GetAt(index - 1).Value.RegisteredAt > registration.RegisteredAt)
        {
            index--;
        }

        _registrations.Insert(index, registration.Id, registration);
    }
}
