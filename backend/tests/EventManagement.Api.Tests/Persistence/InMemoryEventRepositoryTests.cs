using System.Collections.Concurrent;
using EventManagement.Api.Common;
using EventManagement.Api.Domain;
using EventManagement.Api.Persistence;
using EventManagement.Api.Tests.Support;
using static EventManagement.Api.Tests.Support.TestData;

namespace EventManagement.Api.Tests.Persistence;

/// <summary>
/// A request can find an event just before another request deletes it. The event it still holds must then refuse
/// changes, as if it had not been found, rather than accept them for an event that no longer exists.
/// </summary>
public sealed class InMemoryEventRepositoryTests
{
    private readonly InMemoryEventRepository _repository = new();

    [Fact]
    public void Register_OnAnEventDeletedAfterItWasFound_FailsAsNotFound()
    {
        var found = FindThenDelete(CreateEvent());

        var result = found.Register("Ada Lovelace", "ada@example.com", Now);

        ResultAssert.Failure(result, ErrorCodes.EventNotFound);
        Assert.Empty(found.GetRegistrations());
    }

    [Fact]
    public void Update_OnAnEventDeletedAfterItWasFound_FailsAsNotFound()
    {
        var found = FindThenDelete(CreateEvent());

        var result = found.Update(Details(title: "Renamed"), Now);

        ResultAssert.Failure(result, ErrorCodes.EventNotFound);
        Assert.NotEqual("Renamed", found.Snapshot().Title);
    }

    [Fact]
    public void Unregister_OnAnEventDeletedAfterItWasFound_FailsAsNotFound()
    {
        var target = CreateEvent();
        var registration = Register(target, attendee: 1);
        var found = FindThenDelete(target);

        var result = found.Unregister(registration.Id, Now);

        ResultAssert.Failure(result, ErrorCodes.EventNotFound);
        Assert.Single(found.GetRegistrations());
    }

    // The order of the checks: invalid input is reported first, then the deletion, then the event's own state.

    [Fact]
    public void Register_InvalidEmailOnADeletedEvent_ReportsValidationErrorFirst()
    {
        var found = FindThenDelete(CreateEvent());

        var result = found.Register("Ada", "not-an-email", Now);

        ResultAssert.ValidationFailure(result, nameof(Registration.Email), ValidationMessages.EmailInvalid);
    }

    [Fact]
    public void Update_InvalidDetailsOnADeletedEvent_ReportsValidationErrorFirst()
    {
        var found = FindThenDelete(CreateEvent());

        var result = found.Update(Details(title: ""), Now);

        ResultAssert.ValidationFailure(result, nameof(EventDetails.Title), ValidationMessages.TitleRequired);
    }

    [Fact]
    public void Register_OnADeletedEventThatHasStarted_ReturnsNotFoundFirst()
    {
        var found = FindThenDelete(CreateEvent(date: Now.AddHours(1)));

        var result = found.Register("Ada Lovelace", "ada@example.com", Now.AddHours(2));

        ResultAssert.Failure(result, ErrorCodes.EventNotFound);
    }

    [Fact]
    public void Update_OnADeletedEventThatHasStarted_ReturnsNotFoundFirst()
    {
        var found = FindThenDelete(CreateEvent(date: Now.AddHours(1)));

        var result = found.Update(Details(date: Now.AddDays(3)), Now.AddHours(2));

        ResultAssert.Failure(result, ErrorCodes.EventNotFound);
    }

    [Fact]
    public void Unregister_OnADeletedEventThatHasStarted_ReturnsNotFoundFirst()
    {
        var target = CreateEvent(date: Now.AddHours(1));
        var registration = Register(target, attendee: 1);
        var found = FindThenDelete(target);

        var result = found.Unregister(registration.Id, Now.AddHours(2));

        ResultAssert.Failure(result, ErrorCodes.EventNotFound);
    }

    [Fact]
    public void Unregister_UnknownRegistrationOfADeletedEvent_ReturnsEventNotFoundFirst()
    {
        var found = FindThenDelete(CreateEvent());

        var result = found.Unregister(Guid.NewGuid(), Now);

        ResultAssert.Failure(result, ErrorCodes.EventNotFound);
    }

    // Changes racing a delete, from many threads at once. One round may not hit the race, so a check that only
    // works some of the time (one moved outside the event's lock, say) still fails some rounds out of these.
    private const int RaceRounds = 300;
    private const int RaceAttempts = 100;

    [Fact]
    public void Register_FromManyThreadsWhileTheEventIsDeleted_StopsAtTheDelete() =>
        AssertNothingChangesAfterTheDelete(
            () =>
            {
                var target = CreateEvent(maxCapacity: 1_000);
                return (target, i => target.Register($"Attendee {i}", $"attendee{i}@example.com", Now));
            },
            target => target.GetRegistrations().Count);

    [Fact]
    public void Update_FromManyThreadsWhileTheEventIsDeleted_StopsAtTheDelete() =>
        AssertNothingChangesAfterTheDelete(
            () =>
            {
                var target = CreateEvent();
                return (target, i => target.Update(Details(title: $"Title {i}"), Now));
            },
            target => target.Snapshot().Title);

    [Fact]
    public void Unregister_FromManyThreadsWhileTheEventIsDeleted_StopsAtTheDelete() =>
        AssertNothingChangesAfterTheDelete(
            () =>
            {
                var target = CreateEvent(maxCapacity: 1_000);
                var registrations = Enumerable.Range(0, RaceAttempts + 1).Select(attendee => Register(target, attendee)).ToArray();
                return (target, i => target.Unregister(registrations[i].Id, Now));
            },
            target => target.GetRegistrations().Count);

    // Each round: many threads change the event through the reference they found, and another request deletes it
    // once half of the changes are done. A change either applies before the delete or is refused as not found, so
    // the event read right after the delete has returned is the event as it stays.
    private static void AssertNothingChangesAfterTheDelete<TState>(
        Func<(Event Target, Func<int, Result> Change)> arrange,
        Func<Event, TState> readState)
    {
        for (var round = 0; round < RaceRounds; round++)
        {
            // Arrange
            var repository = new InMemoryEventRepository();
            var (target, change) = arrange();
            repository.Add(target);
            var unexpectedErrors = new ConcurrentBag<string>();
            var completed = 0;
            var removed = false;
            TState? stateAtDelete = default;

            // Act
            Parallel.For(0, RaceAttempts, i =>
            {
                var result = change(i);
                if (!result.IsSuccess && result.Error.Code != ErrorCodes.EventNotFound)
                {
                    unexpectedErrors.Add(result.Error.Code);
                }

                if (Interlocked.Increment(ref completed) == RaceAttempts / 2)
                {
                    removed = repository.Remove(target.Id);
                    stateAtDelete = readState(target);
                }
            });

            // Assert
            Assert.True(removed);
            Assert.Empty(unexpectedErrors);
            Assert.Equal(stateAtDelete, readState(target));
            ResultAssert.Failure(change(RaceAttempts), ErrorCodes.EventNotFound);
        }
    }

    // The event as one request holds it: found in the store, then deleted by another request.
    private Event FindThenDelete(Event target)
    {
        _repository.Add(target);
        var found = _repository.GetById(target.Id);
        Assert.NotNull(found);
        Assert.True(_repository.Remove(target.Id));
        return found;
    }
}
