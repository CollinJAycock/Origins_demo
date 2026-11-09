using EventManagement.Api.Contracts;
using EventManagement.Api.Domain;
using EventManagement.Api.Persistence;
using EventManagement.Api.Services;
using EventManagement.Api.Tests.Support;
using Microsoft.Extensions.Time.Testing;

namespace EventManagement.Api.Tests.Services;

public sealed class EventServiceTests
{
    private readonly FakeTimeProvider _clock = new(TestData.Now);
    private readonly EventService _events;
    private readonly RegistrationService _registrations;

    public EventServiceTests()
    {
        var repository = new InMemoryEventRepository();
        _events = new EventService(repository, _clock);
        _registrations = new RegistrationService(repository, _clock);
    }

    [Fact]
    public void Create_WithValidRequest_ReturnsEventWithComputedFields()
    {
        var date = _clock.GetUtcNow().AddDays(3);

        var result = _events.Create(NewEvent(date, maxCapacity: 30));

        ResultAssert.Success(result);
        var created = result.Value;
        Assert.Equal("Workshop", created.Title);
        Assert.Equal(date, created.Date);
        Assert.Equal(30, created.MaxCapacity);
        Assert.Equal(0, created.RegisteredCount);
        Assert.Equal(30, created.AvailableSpots);
        Assert.False(created.IsFull);
        Assert.False(created.IsPast);
        Assert.Equal(_clock.GetUtcNow(), created.CreatedAt);
        Assert.Equal(created.CreatedAt, created.UpdatedAt);
    }

    [Fact]
    public void Create_WithMissingFields_ReturnsValidationErrorsInsteadOfStoringDefaults()
    {
        string[] expectedFields = ["Date", "MaxCapacity", "Title"];

        var result = _events.Create(new CreateEventRequest());

        var error = ResultAssert.Failure(result, ErrorCodes.ValidationFailed);
        Assert.Equal(expectedFields, error.FieldErrors.Keys.Order());
        Assert.Equal(0, _events.List(new EventListQuery()).TotalCount);
    }

    [Fact]
    public void GetById_WhenEventExists_ReturnsItsCurrentRegistrationFigures()
    {
        var id = CreateEvent(maxCapacity: 2);
        Register(id, "ada@example.com");
        Register(id, "grace@example.com");

        var result = _events.GetById(id);

        ResultAssert.Success(result);
        Assert.Equal(2, result.Value.RegisteredCount);
        Assert.Equal(0, result.Value.AvailableSpots);
        Assert.True(result.Value.IsFull);
    }

    [Fact]
    public void GetById_WhenEventDoesNotExist_ReturnsEventNotFound()
    {
        var unknownId = Guid.NewGuid();

        var result = _events.GetById(unknownId);

        var error = ResultAssert.Failure(result, ErrorCodes.EventNotFound);
        Assert.Equal($"Event '{unknownId}' was not found.", error.Message);
    }

    [Fact]
    public void GetById_AfterClockPassesEventDate_ReportsEventAsPast()
    {
        var id = CreateEvent(date: _clock.GetUtcNow().AddHours(1));
        Assert.False(_events.GetById(id).Value.IsPast);

        _clock.Advance(TimeSpan.FromHours(1));

        Assert.True(_events.GetById(id).Value.IsPast);
    }

    [Fact]
    public void Update_WhenEventExists_ReturnsUpdatedEvent()
    {
        var id = CreateEvent();
        _clock.Advance(TimeSpan.FromMinutes(5));
        var request = new UpdateEventRequest
        {
            Title = "Renamed",
            Description = null,
            Date = _clock.GetUtcNow().AddDays(10),
            MaxCapacity = 99,
        };

        var result = _events.Update(id, request);

        ResultAssert.Success(result);
        Assert.Equal("Renamed", result.Value.Title);
        Assert.Null(result.Value.Description);
        Assert.Equal(99, result.Value.MaxCapacity);
        Assert.Equal(_clock.GetUtcNow(), result.Value.UpdatedAt);
        Assert.Equal(result.Value, _events.GetById(id).Value);
    }

    [Fact]
    public void Update_WhenEventDoesNotExist_ReturnsEventNotFound()
    {
        var request = new UpdateEventRequest { Title = "Renamed", Date = _clock.GetUtcNow().AddDays(1), MaxCapacity = 5 };

        var result = _events.Update(Guid.NewGuid(), request);

        ResultAssert.Failure(result, ErrorCodes.EventNotFound);
    }

    [Fact]
    public void Update_AfterClockPassesEventDate_ReturnsEventInPast()
    {
        var id = CreateEvent(date: _clock.GetUtcNow().AddHours(1));
        _clock.Advance(TimeSpan.FromHours(2));
        var request = new UpdateEventRequest { Title = "Too late", Date = _clock.GetUtcNow().AddDays(1), MaxCapacity = 5 };

        var result = _events.Update(id, request);

        ResultAssert.Failure(result, ErrorCodes.EventInPast);
    }

    [Fact]
    public void Delete_WhenEventExists_RemovesEventAndItsRegistrations()
    {
        var id = CreateEvent();
        var registrationId = Register(id, "ada@example.com");

        var result = _events.Delete(id);

        ResultAssert.Success(result);
        ResultAssert.Failure(_events.GetById(id), ErrorCodes.EventNotFound);
        ResultAssert.Failure(_registrations.List(id), ErrorCodes.EventNotFound);
        ResultAssert.Failure(_registrations.GetById(id, registrationId), ErrorCodes.EventNotFound);
    }

    [Fact]
    public void Delete_WhenEventDoesNotExist_ReturnsEventNotFound()
    {
        var result = _events.Delete(Guid.NewGuid());

        ResultAssert.Failure(result, ErrorCodes.EventNotFound);
    }

    [Fact]
    public void Delete_AfterEventHasStarted_Succeeds()
    {
        var id = CreateEvent(date: _clock.GetUtcNow().AddHours(1));
        _clock.Advance(TimeSpan.FromDays(1));

        var result = _events.Delete(id);

        ResultAssert.Success(result);
    }

    private CreateEventRequest NewEvent(DateTimeOffset date, int maxCapacity = 10) =>
        new() { Title = "Workshop", Description = "Bring a laptop.", Date = date, MaxCapacity = maxCapacity };

    private Guid CreateEvent(int maxCapacity = 10, DateTimeOffset? date = null) =>
        _events.Create(NewEvent(date ?? _clock.GetUtcNow().AddDays(7), maxCapacity)).Value.Id;

    private Guid Register(Guid eventId, string email) =>
        _registrations.Register(eventId, new CreateRegistrationRequest { Name = "Attendee", Email = email }).Value.Id;
}
