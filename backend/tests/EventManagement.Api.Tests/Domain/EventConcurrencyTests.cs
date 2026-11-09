using System.Collections.Concurrent;
using EventManagement.Api.Common;
using EventManagement.Api.Domain;
using static EventManagement.Api.Tests.Support.TestData;

namespace EventManagement.Api.Tests.Domain;

/// <summary>
/// Hammers one event from many threads. The assertions hold for every possible interleaving, so the tests are
/// deterministic: without the per-event lock they fail (more successes than spots, or duplicate registrations).
/// </summary>
public sealed class EventConcurrencyTests
{
    [Fact]
    public void Register_FromManyThreadsAtOnce_FillsExactlyToCapacity()
    {
        // Arrange
        const int capacity = 50;
        const int attempts = 200;
        var target = CreateEvent(maxCapacity: capacity);
        var results = new Result<Registration>[attempts];

        // Act
        Parallel.For(0, attempts, i => results[i] = target.Register($"Attendee {i}", $"attendee{i}@example.com", Now));

        // Assert
        Assert.Equal(capacity, results.Count(result => result.IsSuccess));
        Assert.All(results.Where(result => !result.IsSuccess), result => Assert.Equal(ErrorCodes.EventFull, result.Error?.Code));
        Assert.Equal(capacity, target.Snapshot().RegisteredCount);
        Assert.Equal(capacity, target.GetRegistrations().Select(registration => registration.Email).Distinct().Count());
    }

    [Fact]
    public void Register_SameEmailFromManyThreadsAtOnce_AcceptsExactlyOne()
    {
        // Arrange
        const int attempts = 50;
        var target = CreateEvent(maxCapacity: 100);
        var results = new Result<Registration>[attempts];

        // Act: vary case and padding so the race also exercises case-insensitive matching.
        Parallel.For(0, attempts, i =>
            results[i] = target.Register("Ada", i % 2 == 0 ? "ada@example.com" : " ADA@Example.com ", Now));

        // Assert
        Assert.Single(results, result => result.IsSuccess);
        Assert.All(results.Where(result => !result.IsSuccess), result => Assert.Equal(ErrorCodes.AlreadyRegistered, result.Error?.Code));
        Assert.Equal(1, target.Snapshot().RegisteredCount);
    }

    [Fact]
    public void UpdateAndRegister_Interleaved_NeverLeaveMoreRegistrationsThanCapacity()
    {
        // Arrange
        var target = CreateEvent(maxCapacity: 100);
        var unexpectedErrors = new ConcurrentBag<string>();
        var invariantViolations = 0;

        // Act: every fourth operation shrinks or grows the capacity while the others register.
        Parallel.For(0, 400, i =>
        {
            Result result = i % 4 == 0
                ? target.Update(Details(maxCapacity: 10 + i % 7 * 10), Now)
                : target.Register($"Attendee {i}", $"attendee{i}@example.com", Now);

            if (!result.IsSuccess
                && result.Error.Code is not (ErrorCodes.EventFull or ErrorCodes.CapacityBelowRegistrations))
            {
                unexpectedErrors.Add(result.Error.Code);
            }

            var snapshot = target.Snapshot();
            if (snapshot.RegisteredCount > snapshot.MaxCapacity)
            {
                Interlocked.Increment(ref invariantViolations);
            }
        });

        // Assert
        Assert.Empty(unexpectedErrors);
        Assert.Equal(0, invariantViolations);
        var final = target.Snapshot();
        Assert.InRange(final.RegisteredCount, 0, final.MaxCapacity);
        Assert.Equal(final.RegisteredCount, target.GetRegistrations().Count);
    }
}
