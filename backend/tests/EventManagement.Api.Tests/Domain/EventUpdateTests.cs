using EventManagement.Api.Domain;
using EventManagement.Api.Tests.Support;
using static EventManagement.Api.Tests.Support.TestData;

namespace EventManagement.Api.Tests.Domain;

public sealed class EventUpdateTests
{
    [Fact]
    public void Update_WithValidDetails_ReplacesDetailsAndStampsUpdatedAt()
    {
        // Arrange
        var target = CreateEvent();
        var later = Now.AddHours(1);
        var newDate = Now.AddDays(14);

        // Act
        var result = target.Update(new EventDetails(" Renamed ", " New description ", newDate, 50), later);

        // Assert
        ResultAssert.Success(result);
        Assert.Equal("Renamed", result.Value.Title);
        Assert.Equal("New description", result.Value.Description);
        Assert.Equal(newDate, result.Value.Date);
        Assert.Equal(50, result.Value.MaxCapacity);
        Assert.Equal(Now, result.Value.CreatedAt);
        Assert.Equal(later, result.Value.UpdatedAt);
        Assert.Equal(result.Value, target.Snapshot());
    }

    [Fact]
    public void Update_AfterEventHasStarted_ReturnsEventInPast()
    {
        var target = CreateEvent(date: Now.AddHours(1));

        var result = target.Update(Details(date: Now.AddDays(7)), Now.AddHours(2));

        var error = ResultAssert.Failure(result, ErrorCodes.EventInPast);
        Assert.Equal("Past events can't be edited.", error.Message);
    }

    [Fact]
    public void Update_AtExactStartTime_ReturnsEventInPast()
    {
        var start = Now.AddHours(1);
        var target = CreateEvent(date: start);

        var result = target.Update(Details(date: Now.AddDays(7)), start);

        ResultAssert.Failure(result, ErrorCodes.EventInPast);
    }

    [Fact]
    public void Update_PastEventWithInvalidDetails_ReportsValidationErrorFirst()
    {
        var target = CreateEvent(date: Now.AddHours(1));

        var result = target.Update(Details(title: "", date: Now), Now.AddHours(2));

        ResultAssert.ValidationFailure(result, nameof(EventDetails.Date), ValidationMessages.DateNotInFuture);
        ResultAssert.ValidationFailure(result, nameof(EventDetails.Title), ValidationMessages.TitleRequired);
    }

    [Fact]
    public void Update_WithDateInPast_ReturnsDateNotInFuture()
    {
        var target = CreateEvent();

        var result = target.Update(Details(date: Now.AddMinutes(-5)), Now);

        ResultAssert.ValidationFailure(result, nameof(EventDetails.Date), ValidationMessages.DateNotInFuture);
    }

    [Fact]
    public void Update_WithCapacityBelowRegistrationCount_ReturnsCapacityBelowRegistrations()
    {
        // Arrange
        var target = CreateEvent(maxCapacity: 5);
        for (var attendee = 0; attendee < 3; attendee++)
        {
            Register(target, attendee);
        }

        // Act
        var result = target.Update(Details(maxCapacity: 2), Now);

        // Assert
        var error = ResultAssert.Failure(result, ErrorCodes.CapacityBelowRegistrations);
        Assert.Equal("Max capacity can't be lower than the current number of registrations (3).", error.Message);
        Assert.Equal(5, target.Snapshot().MaxCapacity);
    }

    [Fact]
    public void Update_WithCapacityEqualToRegistrationCount_SucceedsAndFillsEvent()
    {
        // Arrange
        var target = CreateEvent(maxCapacity: 5);
        for (var attendee = 0; attendee < 3; attendee++)
        {
            Register(target, attendee);
        }

        // Act
        var result = target.Update(Details(maxCapacity: 3), Now);

        // Assert
        ResultAssert.Success(result);
        Assert.True(result.Value.IsFull);
        Assert.Equal(0, result.Value.AvailableSpots);
    }

    [Fact]
    public void Update_WithInvalidDetails_LeavesEventUnchanged()
    {
        var target = CreateEvent();
        var before = target.Snapshot();

        var result = target.Update(Details(title: "", maxCapacity: 0), Now.AddHours(1));

        ResultAssert.Failure(result, ErrorCodes.ValidationFailed);
        Assert.Equal(before, target.Snapshot());
    }
}
