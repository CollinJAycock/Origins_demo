using EventManagement.Api.Domain;
using EventManagement.Api.Tests.Support;
using static EventManagement.Api.Tests.Support.TestData;

namespace EventManagement.Api.Tests.Domain;

public sealed class EventCreateTests
{
    [Fact]
    public void Create_WithValidDetails_NormalizesFieldsAndStampsTimes()
    {
        // Arrange
        var dateWithOffset = new DateTimeOffset(2026, 7, 1, 20, 0, 0, TimeSpan.FromHours(2));
        var details = Details(title: "  Workshop  ", description: "   ", date: dateWithOffset, maxCapacity: 25);

        // Act
        var result = Event.Create(details, Now);

        // Assert
        ResultAssert.Success(result);
        var snapshot = result.Value.Snapshot();
        Assert.Equal("Workshop", snapshot.Title);
        Assert.Null(snapshot.Description);
        Assert.Equal(new DateTimeOffset(2026, 7, 1, 18, 0, 0, TimeSpan.Zero), snapshot.Date);
        Assert.Equal(TimeSpan.Zero, snapshot.Date.Offset);
        Assert.Equal(25, snapshot.MaxCapacity);
        Assert.Equal(0, snapshot.RegisteredCount);
        Assert.Equal(Now, snapshot.CreatedAt);
        Assert.Equal(Now, snapshot.UpdatedAt);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\u200B")] // zero-width space
    [InlineData(" \u00AD\uFEFF ")] // soft hyphen and byte order mark
    [InlineData("\u3164")] // Hangul filler
    [InlineData("\u2800")] // blank Braille pattern
    [InlineData("\u034F\uFE0F")] // combining grapheme joiner and a variation selector
    [InlineData("\u0301")] // a combining accent with no letter to sit on
    public void Create_WithBlankTitle_ReturnsTitleRequired(string title)
    {
        var result = Event.Create(Details(title: title), Now);

        ResultAssert.ValidationFailure(result, nameof(EventDetails.Title), ValidationMessages.TitleRequired);
    }

    [Theory]
    [InlineData("Line one\nLine two")]
    [InlineData("Tab\tseparated")]
    [InlineData("Reversed \u202Etext")] // right-to-left override
    [InlineData("\u2066Isolated\u2069")] // left-to-right isolate
    public void Create_WithControlCharacterInTitle_ReturnsTitleInvalidCharacters(string title)
    {
        var result = Event.Create(Details(title: title), Now);

        ResultAssert.ValidationFailure(result, nameof(EventDetails.Title), ValidationMessages.TitleInvalidCharacters);
    }

    [Fact]
    public void Create_WithEmojiSequenceInTitle_Succeeds()
    {
        // Man, woman and girl joined by zero-width joiners: one family emoji.
        const string title = "Family picnic \U0001F468\u200D\U0001F469\u200D\U0001F467";

        var result = Event.Create(Details(title: title), Now);

        ResultAssert.Success(result);
        Assert.Equal(title, result.Value.Snapshot().Title);
    }

    [Fact]
    public void Create_WithCombiningAccentInTitle_Succeeds()
    {
        // "Café" with the accent as a separate combining character, as macOS spells it in file names.
        const string title = "Cafe\u0301 meetup";

        var result = Event.Create(Details(title: title), Now);

        ResultAssert.Success(result);
        Assert.Equal(title, result.Value.Snapshot().Title);
    }

    [Fact]
    public void Create_WithTitleLongerThanLimit_ReturnsTitleTooLong()
    {
        var result = Event.Create(Details(title: new string('a', EventLimits.TitleMaxLength + 1)), Now);

        ResultAssert.ValidationFailure(result, nameof(EventDetails.Title), ValidationMessages.TitleTooLong);
    }

    [Fact]
    public void Create_WithTitleAtLimitAfterTrimming_Succeeds()
    {
        var paddedTitle = $"  {new string('a', EventLimits.TitleMaxLength)}  ";

        var result = Event.Create(Details(title: paddedTitle), Now);

        ResultAssert.Success(result);
        Assert.Equal(EventLimits.TitleMaxLength, result.Value.Snapshot().Title.Length);
    }

    [Fact]
    public void Create_WithDescriptionLongerThanLimit_ReturnsDescriptionTooLong()
    {
        var result = Event.Create(Details(description: new string('d', EventLimits.DescriptionMaxLength + 1)), Now);

        ResultAssert.ValidationFailure(result, nameof(EventDetails.Description), ValidationMessages.DescriptionTooLong);
    }

    [Fact]
    public void Create_WithDescriptionAtLimit_Succeeds()
    {
        var result = Event.Create(Details(description: new string('d', EventLimits.DescriptionMaxLength)), Now);

        ResultAssert.Success(result);
    }

    [Fact]
    public void Create_WithLineBreaksAndTabsInDescription_KeepsThem()
    {
        const string description = "Agenda:\r\n\t1. Welcome\n\t2. Lightning talks";

        var result = Event.Create(Details(description: description), Now);

        ResultAssert.Success(result);
        Assert.Equal(description, result.Value.Snapshot().Description);
    }

    [Theory]
    [InlineData("Null\u0000character")]
    [InlineData("Page\fbreak")]
    [InlineData("Reversed \u202Etext")] // right-to-left override
    public void Create_WithControlCharacterInDescription_ReturnsDescriptionInvalidCharacters(string description)
    {
        var result = Event.Create(Details(description: description), Now);

        ResultAssert.ValidationFailure(result, nameof(EventDetails.Description), ValidationMessages.DescriptionInvalidCharacters);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(EventLimits.MaxCapacity + 1)]
    public void Create_WithCapacityOutOfRange_ReturnsCapacityOutOfRange(int maxCapacity)
    {
        var result = Event.Create(Details(maxCapacity: maxCapacity), Now);

        ResultAssert.ValidationFailure(result, nameof(EventDetails.MaxCapacity), ValidationMessages.MaxCapacityOutOfRange);
    }

    [Theory]
    [InlineData(EventLimits.MinCapacity)]
    [InlineData(EventLimits.MaxCapacity)]
    public void Create_WithCapacityAtBounds_Succeeds(int maxCapacity)
    {
        var result = Event.Create(Details(maxCapacity: maxCapacity), Now);

        ResultAssert.Success(result);
    }

    [Fact]
    public void Create_WithDateInPast_ReturnsDateNotInFuture()
    {
        var result = Event.Create(Details(date: Now.AddMinutes(-1)), Now);

        ResultAssert.ValidationFailure(result, nameof(EventDetails.Date), ValidationMessages.DateNotInFuture);
    }

    [Fact]
    public void Create_WithDateEqualToNow_ReturnsDateNotInFuture()
    {
        var result = Event.Create(Details(date: Now), Now);

        ResultAssert.ValidationFailure(result, nameof(EventDetails.Date), ValidationMessages.DateNotInFuture);
    }

    [Fact]
    public void Create_WithDateJustAfterNow_Succeeds()
    {
        var result = Event.Create(Details(date: Now.AddTicks(1)), Now);

        ResultAssert.Success(result);
    }

    [Fact]
    public void Create_WithSeveralInvalidFields_ReportsEveryField()
    {
        // Arrange
        var details = new EventDetails(" ", new string('d', EventLimits.DescriptionMaxLength + 1), Now, 0);
        string[] expectedFields = ["Date", "Description", "MaxCapacity", "Title"];

        // Act
        var result = Event.Create(details, Now);

        // Assert
        var error = ResultAssert.Failure(result, ErrorCodes.ValidationFailed);
        Assert.Equal(expectedFields, error.FieldErrors.Keys.Order());
    }
}
