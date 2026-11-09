using EventManagement.Api.Domain;

namespace EventManagement.Api.Tests.Support;

/// <summary>Builders for valid domain objects at a fixed point in time, so tests only spell out what they vary.</summary>
internal static class TestData
{
    public static readonly DateTimeOffset Now = new(2026, 6, 15, 12, 0, 0, TimeSpan.Zero);

    public static EventDetails Details(
        string title = "Intro to ASP.NET Core",
        string? description = "A hands-on workshop.",
        DateTimeOffset? date = null,
        int maxCapacity = 10) =>
        new(title, description, date ?? Now.AddDays(7), maxCapacity);

    public static Event CreateEvent(int maxCapacity = 10, DateTimeOffset? date = null, DateTimeOffset? now = null) =>
        Event.Create(Details(date: date, maxCapacity: maxCapacity), now ?? Now).Value;

    public static Registration Register(Event target, int attendee, DateTimeOffset? now = null) =>
        target.Register($"Attendee {attendee}", $"attendee{attendee}@example.com", now ?? Now).Value;
}
