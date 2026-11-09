using EventManagement.Api.Contracts;
using EventManagement.Api.Domain;
using EventManagement.Api.Persistence;
using EventManagement.Api.Services;
using EventManagement.Api.Tests.Support;
using Microsoft.Extensions.Time.Testing;

namespace EventManagement.Api.Tests.Services;

public sealed class RegistrationServiceTests
{
    private readonly FakeTimeProvider _clock = new(TestData.Now);
    private readonly EventService _events;
    private readonly RegistrationService _registrations;

    public RegistrationServiceTests()
    {
        var repository = new InMemoryEventRepository();
        _events = new EventService(repository, _clock);
        _registrations = new RegistrationService(repository, _clock);
    }

    [Fact]
    public void Register_WithValidRequest_ReturnsRegistrationAndTakesASpot()
    {
        var eventId = CreateEvent();

        var result = _registrations.Register(eventId, new CreateRegistrationRequest { Name = "Ada", Email = "ada@example.com" });

        ResultAssert.Success(result);
        Assert.Equal(eventId, result.Value.EventId);
        Assert.Equal("Ada", result.Value.Name);
        Assert.Equal("ada@example.com", result.Value.Email);
        Assert.Equal(_clock.GetUtcNow(), result.Value.RegisteredAt);
        Assert.Equal(1, _events.GetById(eventId).Value.RegisteredCount);
    }

    [Fact]
    public void Register_WithMissingFields_ReturnsValidationErrors()
    {
        var eventId = CreateEvent();
        string[] expectedFields = ["Email", "Name"];

        var result = _registrations.Register(eventId, new CreateRegistrationRequest());

        var error = ResultAssert.Failure(result, ErrorCodes.ValidationFailed);
        Assert.Equal(expectedFields, error.FieldErrors.Keys.Order());
    }

    [Fact]
    public void Register_WhenEventDoesNotExist_ReturnsEventNotFound()
    {
        var result = _registrations.Register(Guid.NewGuid(), Attendee("ada@example.com"));

        ResultAssert.Failure(result, ErrorCodes.EventNotFound);
    }

    [Fact]
    public void Register_AfterClockPassesEventDate_ReturnsEventInPast()
    {
        var eventId = CreateEvent(date: _clock.GetUtcNow().AddHours(1));
        ResultAssert.Success(_registrations.Register(eventId, Attendee("ada@example.com")));

        _clock.Advance(TimeSpan.FromHours(1));
        var result = _registrations.Register(eventId, Attendee("grace@example.com"));

        ResultAssert.Failure(result, ErrorCodes.EventInPast);
    }

    [Fact]
    public void List_ReturnsRegistrationsOldestFirst()
    {
        var eventId = CreateEvent();
        foreach (var email in new[] { "first@example.com", "second@example.com", "third@example.com" })
        {
            Register(eventId, email);
            _clock.Advance(TimeSpan.FromMinutes(1));
        }

        var result = _registrations.List(eventId);

        ResultAssert.Success(result);
        Assert.Equal(
            ["first@example.com", "second@example.com", "third@example.com"],
            result.Value.Select(registration => registration.Email));
    }

    [Fact]
    public void List_WhenEventDoesNotExist_ReturnsEventNotFound()
    {
        var result = _registrations.List(Guid.NewGuid());

        ResultAssert.Failure(result, ErrorCodes.EventNotFound);
    }

    [Fact]
    public void GetById_WhenRegistrationExists_ReturnsIt()
    {
        var eventId = CreateEvent();
        var registrationId = Register(eventId, "ada@example.com");

        var result = _registrations.GetById(eventId, registrationId);

        ResultAssert.Success(result);
        Assert.Equal(registrationId, result.Value.Id);
        Assert.Equal("ada@example.com", result.Value.Email);
    }

    [Fact]
    public void GetById_WithRegistrationOfAnotherEvent_ReturnsRegistrationNotFound()
    {
        var registrationId = Register(CreateEvent(), "ada@example.com");
        var otherEventId = CreateEvent();

        var result = _registrations.GetById(otherEventId, registrationId);

        ResultAssert.Failure(result, ErrorCodes.RegistrationNotFound);
    }

    [Fact]
    public void GetById_WhenEventDoesNotExist_ReturnsEventNotFound()
    {
        var result = _registrations.GetById(Guid.NewGuid(), Guid.NewGuid());

        ResultAssert.Failure(result, ErrorCodes.EventNotFound);
    }

    [Fact]
    public void Unregister_ExistingRegistration_FreesItsSpot()
    {
        var eventId = CreateEvent(maxCapacity: 1);
        var registrationId = Register(eventId, "ada@example.com");

        var result = _registrations.Unregister(eventId, registrationId);

        ResultAssert.Success(result);
        var updated = _events.GetById(eventId).Value;
        Assert.Equal(0, updated.RegisteredCount);
        Assert.Equal(1, updated.AvailableSpots);
        Assert.False(updated.IsFull);
    }

    [Fact]
    public void Unregister_WithRegistrationOfAnotherEvent_ReturnsRegistrationNotFound()
    {
        var registrationId = Register(CreateEvent(), "ada@example.com");

        var result = _registrations.Unregister(CreateEvent(), registrationId);

        ResultAssert.Failure(result, ErrorCodes.RegistrationNotFound);
    }

    [Fact]
    public void Unregister_WhenEventDoesNotExist_ReturnsEventNotFound()
    {
        var result = _registrations.Unregister(Guid.NewGuid(), Guid.NewGuid());

        ResultAssert.Failure(result, ErrorCodes.EventNotFound);
    }

    [Fact]
    public void Unregister_AfterClockPassesEventDate_ReturnsEventInPast()
    {
        var eventId = CreateEvent(date: _clock.GetUtcNow().AddHours(1));
        var registrationId = Register(eventId, "ada@example.com");
        _clock.Advance(TimeSpan.FromHours(2));

        var result = _registrations.Unregister(eventId, registrationId);

        ResultAssert.Failure(result, ErrorCodes.EventInPast);
    }

    private static CreateRegistrationRequest Attendee(string email) => new() { Name = "Attendee", Email = email };

    private Guid CreateEvent(int maxCapacity = 10, DateTimeOffset? date = null)
    {
        var request = new CreateEventRequest
        {
            Title = "Workshop",
            Date = date ?? _clock.GetUtcNow().AddDays(7),
            MaxCapacity = maxCapacity,
        };

        return _events.Create(request).Value.Id;
    }

    private Guid Register(Guid eventId, string email) => _registrations.Register(eventId, Attendee(email)).Value.Id;
}
