using EventManagement.Api.Contracts;
using EventManagement.Api.Persistence;
using EventManagement.Api.Services;
using EventManagement.Api.Tests.Support;
using Microsoft.Extensions.Time.Testing;

namespace EventManagement.Api.Tests.Services;

public sealed class EventServiceListTests
{
    private readonly FakeTimeProvider _clock = new(TestData.Now);
    private readonly EventService _service;

    public EventServiceListTests() => _service = new EventService(new InMemoryEventRepository(), _clock);

    [Theory]
    [InlineData(EventStatusFilter.Upcoming, new[] { "Charlie", "Delta", "Echo" })]
    [InlineData(EventStatusFilter.Past, new[] { "Bravo", "Alpha" })]
    [InlineData(EventStatusFilter.All, new[] { "Alpha", "Bravo", "Charlie", "Delta", "Echo" })]
    public void List_ByStatus_ReturnsMatchingEventsInThatStatusOrder(EventStatusFilter status, string[] expectedTitles)
    {
        // Arrange: five events, then travel ten days ahead so the first two have started.
        Add("Echo", TimeSpan.FromDays(20));
        Add("Alpha", TimeSpan.FromDays(2));
        Add("Delta", TimeSpan.FromDays(15));
        Add("Bravo", TimeSpan.FromDays(5));
        Add("Charlie", TimeSpan.FromDays(12));
        _clock.Advance(TimeSpan.FromDays(10));

        // Act
        var page = _service.List(new EventListQuery(status));

        // Assert
        Assert.Equal(expectedTitles, page.Items.Select(item => item.Title));
        Assert.Equal(expectedTitles.Length, page.TotalCount);
        Assert.All(page.Items, item => Assert.Equal(item.Title is "Alpha" or "Bravo", item.IsPast));
    }

    [Fact]
    public void List_WithSearch_MatchesTitleOrDescriptionCaseInsensitively()
    {
        Add("Intro to React", TimeSpan.FromDays(1));
        Add("Frontend meetup", TimeSpan.FromDays(2), description: "Talks on REACT server components.");
        Add("Gardening club", TimeSpan.FromDays(3), description: "Seasonal planting.");

        var page = _service.List(new EventListQuery(Search: "react"));

        Assert.Equal(["Intro to React", "Frontend meetup"], page.Items.Select(item => item.Title));
    }

    [Fact]
    public void List_WithBlankSearch_DoesNotFilter()
    {
        Add("Alpha", TimeSpan.FromDays(1));
        Add("Bravo", TimeSpan.FromDays(2));

        var page = _service.List(new EventListQuery(Search: "   "));

        Assert.Equal(2, page.TotalCount);
    }

    [Fact]
    public void List_WithSearchAndStatus_AppliesBothFilters()
    {
        Add("Old workshop", TimeSpan.FromDays(1));
        Add("New workshop", TimeSpan.FromDays(5));
        Add("New meetup", TimeSpan.FromDays(6));
        _clock.Advance(TimeSpan.FromDays(2));

        var page = _service.List(new EventListQuery(EventStatusFilter.Upcoming, Search: "WORKSHOP"));

        Assert.Equal(["New workshop"], page.Items.Select(item => item.Title));
    }

    [Theory]
    [InlineData(1, new[] { "Event 1", "Event 2" })]
    [InlineData(2, new[] { "Event 3", "Event 4" })]
    [InlineData(3, new[] { "Event 5" })]
    [InlineData(4, new string[0])]
    public void List_WithPaging_ReturnsRequestedSliceAndTotals(int pageNumber, string[] expectedTitles)
    {
        for (var day = 1; day <= 5; day++)
        {
            Add($"Event {day}", TimeSpan.FromDays(day));
        }

        var page = _service.List(new EventListQuery(Page: pageNumber, PageSize: 2));

        Assert.Equal(expectedTitles, page.Items.Select(item => item.Title));
        Assert.Equal(pageNumber, page.Page);
        Assert.Equal(2, page.PageSize);
        Assert.Equal(5, page.TotalCount);
        Assert.Equal(3, page.TotalPages);
    }

    [Fact]
    public void List_WithLargestPossiblePageNumber_ReturnsEmptyPageWithoutOverflowing()
    {
        Add("Only event", TimeSpan.FromDays(1));

        var page = _service.List(new EventListQuery(Page: int.MaxValue, PageSize: EventListQuery.MaxPageSize));

        Assert.Empty(page.Items);
        Assert.Equal(1, page.TotalCount);
    }

    [Theory]
    [InlineData(0, 10)]
    [InlineData(1, 0)]
    [InlineData(1, EventListQuery.MaxPageSize + 1)]
    public void List_WithPagingOutsideTheValidatedRange_Throws(int pageNumber, int pageSize)
    {
        var query = new EventListQuery(Page: pageNumber, PageSize: pageSize);

        Assert.Throws<ArgumentOutOfRangeException>(() => _service.List(query));
    }

    [Fact]
    public void List_WhenNothingMatches_ReturnsEmptyPageWithZeroTotalPages()
    {
        Add("Alpha", TimeSpan.FromDays(1));

        var page = _service.List(new EventListQuery(Search: "no such event"));

        Assert.Empty(page.Items);
        Assert.Equal(0, page.TotalCount);
        Assert.Equal(0, page.TotalPages);
    }

    [Fact]
    public void List_WithEventsAtTheSameTime_OrdersByTitleIgnoringCaseThenById()
    {
        // Arrange
        var sameStart = TimeSpan.FromDays(3);
        Add("charlie", sameStart);
        var twinIds = new[] { Add("Bravo", sameStart), Add("Bravo", sameStart) };
        Add("Alpha", sameStart);

        // Act
        var items = _service.List(new EventListQuery()).Items;

        // Assert
        Assert.Equal(["Alpha", "Bravo", "Bravo", "charlie"], items.Select(item => item.Title));
        Assert.Equal(twinIds.Order(), items.Where(item => item.Title == "Bravo").Select(item => item.Id));
    }

    private Guid Add(string title, TimeSpan startsIn, string? description = null)
    {
        var request = new CreateEventRequest
        {
            Title = title,
            Description = description,
            Date = _clock.GetUtcNow() + startsIn,
            MaxCapacity = 10,
        };

        return _service.Create(request).Value.Id;
    }
}
