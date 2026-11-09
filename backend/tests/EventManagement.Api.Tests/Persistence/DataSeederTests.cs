using EventManagement.Api.Persistence;
using EventManagement.Api.Tests.Support;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;

namespace EventManagement.Api.Tests.Persistence;

public sealed class DataSeederTests
{
    private readonly FakeTimeProvider _clock = new(TestData.Now);
    private readonly InMemoryEventRepository _repository = new();

    [Fact]
    public void Seed_CreatesUpcomingAndPastEventsInEveryInterestingState()
    {
        new DataSeeder(_repository, _clock, NullLogger<DataSeeder>.Instance).Seed();

        var now = _clock.GetUtcNow();
        var snapshots = _repository.GetAll().Select(seeded => seeded.Snapshot()).ToList();
        var upcoming = snapshots.Where(snapshot => !snapshot.HasStarted(now)).ToList();
        var past = snapshots.Where(snapshot => snapshot.HasStarted(now)).ToList();
        Assert.Equal(7, snapshots.Count);
        Assert.Equal(5, upcoming.Count);
        Assert.Equal(2, past.Count);
        Assert.Contains(upcoming, snapshot => snapshot.IsFull);
        Assert.Contains(upcoming, snapshot => snapshot.AvailableSpots == 1);
        Assert.Contains(upcoming, snapshot => snapshot.RegisteredCount == 0);
        Assert.All(past, snapshot => Assert.True(snapshot.RegisteredCount > 0));
    }

    [Fact]
    public void Seed_CreatesUniqueAttendeesWhoRegisteredBeforeEachEventStarted()
    {
        new DataSeeder(_repository, _clock, NullLogger<DataSeeder>.Instance).Seed();

        foreach (var seeded in _repository.GetAll())
        {
            var snapshot = seeded.Snapshot();
            var registrations = seeded.GetRegistrations();
            Assert.Equal(registrations.Count, registrations.Select(registration => registration.Email).Distinct().Count());
            Assert.All(registrations, registration =>
            {
                Assert.Matches(@"^[a-z]+\.[a-z]+@example\.com$", registration.Email);
                Assert.InRange(registration.RegisteredAt, snapshot.CreatedAt, snapshot.Date.AddTicks(-1));
            });
        }
    }
}
