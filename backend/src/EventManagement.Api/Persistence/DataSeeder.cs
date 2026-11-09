using EventManagement.Api.Common;
using EventManagement.Api.Domain;

namespace EventManagement.Api.Persistence;

/// <summary>
/// Fills the store with realistic demo events dated relative to the current time: upcoming events that are open,
/// nearly full, full or empty, plus past events with attendees. History is created through the normal domain
/// methods with an earlier "now", so seed data obeys exactly the same rules as live data.
/// </summary>
public sealed class DataSeeder(IEventRepository repository, TimeProvider timeProvider, ILogger<DataSeeder> logger)
{
    // UTC start hours, chosen to give plausible local times in US time zones.
    private static readonly SeedEvent[] Events =
    [
        new("Intro to ASP.NET Core Workshop",
            "A hands-on workshop covering controllers, dependency injection, configuration and testing. "
            + "Bring a laptop with the .NET SDK installed.",
            StartsInDays: 5, StartHourUtc: 17, MaxCapacity: 30, Attendees: 18, CreatedDaysAgo: 20),
        new("Designing Resilient APIs",
            "Timeouts, retries, idempotency keys and graceful degradation: patterns for APIs that keep working "
            + "when their dependencies don't.",
            StartsInDays: 12, StartHourUtc: 18, MaxCapacity: 50, Attendees: 7, CreatedDaysAgo: 10),
        new("Startup Pitch Night",
            "Eight founders, five minutes each, followed by questions from a panel of local investors.",
            StartsInDays: 3, StartHourUtc: 22, MaxCapacity: 8, Attendees: 8, CreatedDaysAgo: 21),
        new("Engineering Leadership Roundtable",
            "A small-group discussion on growing teams, running effective one-on-ones and keeping delivery predictable.",
            StartsInDays: 21, StartHourUtc: 16, MaxCapacity: 15, Attendees: 14, CreatedDaysAgo: 25),
        new("Community Hackathon",
            "A day of building with open data. Teams of up to four, with prizes for the most useful, "
            + "most creative and best-designed projects.",
            StartsInDays: 42, StartHourUtc: 15, MaxCapacity: 120, Attendees: 0, CreatedDaysAgo: 2),
        new("Cloud Cost Optimization Meetup",
            "Practical techniques for right-sizing workloads, choosing pricing models and spotting waste before "
            + "the invoice arrives.",
            StartsInDays: -9, StartHourUtc: 18, MaxCapacity: 40, Attendees: 32, CreatedDaysAgo: 45),
        new("Accessibility Fundamentals for Web Developers",
            "Semantic HTML, keyboard navigation, color contrast and screen reader testing, with live audits of real pages.",
            StartsInDays: -30, StartHourUtc: 17, MaxCapacity: 25, Attendees: 25, CreatedDaysAgo: 60),
    ];

    private static readonly string[] FirstNames =
    [
        "Ava", "Ben", "Chloe", "Daniel", "Emma", "Felix", "Grace", "Henry", "Isla", "Jack",
        "Kara", "Liam", "Maya", "Noah", "Olivia", "Priya", "Quinn", "Ravi", "Sofia", "Theo",
    ];

    private static readonly string[] LastNames =
    [
        "Anderson", "Brooks", "Chen", "Diaz", "Evans", "Foster", "Garcia", "Hughes", "Ito", "Jensen",
        "Kim", "Lopez", "Murphy", "Nguyen", "Okafor", "Patel", "Reyes", "Schmidt", "Turner", "Walsh",
    ];

    /// <summary>Adds the demo events. Intended to run once, at startup.</summary>
    public void Seed()
    {
        var now = timeProvider.GetUtcNow();
        for (var index = 0; index < Events.Length; index++)
        {
            // Offset each event's attendee range so attendee lists differ between events.
            repository.Add(Build(Events[index], firstAttendee: index * 7, now));
        }

        logger.LogInformation("Seeded {Count} demo events", Events.Length);
    }

    private static Event Build(SeedEvent seed, int firstAttendee, DateTimeOffset now)
    {
        var startOfToday = new DateTimeOffset(now.UtcDateTime.Date, TimeSpan.Zero);
        var date = startOfToday.AddDays(seed.StartsInDays).AddHours(seed.StartHourUtc);
        var createdAt = now.AddDays(-seed.CreatedDaysAgo);
        var details = new EventDetails(seed.Title, seed.Description, date, seed.MaxCapacity);
        var seeded = Require(Event.Create(details, createdAt));

        // Spread sign-ups evenly between creation and whichever comes first: now or the event's start.
        var signUpWindow = (date < now ? date : now) - createdAt;
        for (var i = 0; i < seed.Attendees; i++)
        {
            var (name, email) = Attendee(firstAttendee + i);
            var registeredAt = createdAt + signUpWindow * (i + 1) / (seed.Attendees + 1);
            Require(seeded.Register(name, email, registeredAt));
        }

        return seeded;
    }

    // Deterministic, unique for index < 400: for a fixed first name, the last-name index is (7a + q) mod 20,
    // which differs for every q = index / 20.
    private static (string Name, string Email) Attendee(int index)
    {
        var first = FirstNames[index % FirstNames.Length];
        var last = LastNames[(index * 7 + index / FirstNames.Length) % LastNames.Length];
        return ($"{first} {last}", $"{first}.{last}@example.com".ToLowerInvariant());
    }

    // Seed data is static, so a rule violation here is a bug: fail startup loudly rather than seed partially.
    private static T Require<T>(Result<T> result) =>
        result.IsSuccess ? result.Value : throw new InvalidOperationException($"Invalid seed data: {result.Error.Message}");

    private sealed record SeedEvent(
        string Title,
        string Description,
        int StartsInDays,
        int StartHourUtc,
        int MaxCapacity,
        int Attendees,
        int CreatedDaysAgo);
}
