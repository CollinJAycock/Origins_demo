using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using EventManagement.Api.Contracts;
using EventManagement.Api.Domain;

namespace EventManagement.Api.Tests.Api;

public sealed class EventsApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    private DateTimeOffset Now => factory.Clock.GetUtcNow();

    [Fact]
    public async Task EventLifecycle_CreateReadUpdateDelete_ReturnsExpectedResponses()
    {
        // Create
        var createResponse = await _client.PostAsJsonAsync("/api/events", NewEvent("Lifecycle event"));
        var created = await ApiAssert.SuccessAsync<EventResponse>(createResponse, HttpStatusCode.Created);
        Assert.Equal($"/api/events/{created.Id}", createResponse.Headers.Location?.AbsolutePath);
        Assert.Equal(created.MaxCapacity, created.AvailableSpots);

        // Read, via the Location header
        var fetched = await _client.GetFromJsonAsync<EventResponse>(createResponse.Headers.Location);
        Assert.Equal(created, fetched);

        // Update
        var update = new UpdateEventRequest { Title = "Renamed event", Date = Now.AddDays(9), MaxCapacity = 40 };
        var updateResponse = await _client.PutAsJsonAsync($"/api/events/{created.Id}", update);
        var updated = await ApiAssert.SuccessAsync<EventResponse>(updateResponse, HttpStatusCode.OK);
        Assert.Equal("Renamed event", updated.Title);
        Assert.Null(updated.Description);
        Assert.Equal(40, updated.MaxCapacity);

        // Delete
        var deleteResponse = await _client.DeleteAsync($"/api/events/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        var detail = await ApiAssert.DetailedProblemAsync(
            await _client.GetAsync($"/api/events/{created.Id}"), HttpStatusCode.NotFound, ErrorCodes.EventNotFound);
        Assert.Equal($"Event '{created.Id}' was not found.", detail);
    }

    [Fact]
    public async Task Create_WithInvalidFields_ReturnsValidationProblemKeyedByJsonNames()
    {
        var body = new { title = "   ", description = new string('d', 2001), date = Now.AddDays(1), maxCapacity = 0 };

        var errors = await ApiAssert.ValidationProblemAsync(await _client.PostAsJsonAsync("/api/events", body));

        Assert.Equal(["description", "maxCapacity", "title"], errors.Keys.Order());
        Assert.Equal([ValidationMessages.TitleRequired], errors["title"]);
        Assert.Equal([ValidationMessages.DescriptionTooLong], errors["description"]);
        Assert.Equal([ValidationMessages.MaxCapacityOutOfRange], errors["maxCapacity"]);
    }

    [Fact]
    public async Task Create_WithMissingFields_ReportsEachAsRequired()
    {
        var errors = await ApiAssert.ValidationProblemAsync(await _client.PostAsJsonAsync("/api/events", new { }));

        Assert.Equal([ValidationMessages.TitleRequired], errors["title"]);
        Assert.Equal([ValidationMessages.DateRequired], errors["date"]);
        Assert.Equal([ValidationMessages.MaxCapacityRequired], errors["maxCapacity"]);
    }

    [Fact]
    public async Task Create_WithPaddedTitleAtLimit_AppliesTheLimitAfterTrimming()
    {
        // Not CreateEventRequest: its init accessor would trim the title before it is sent.
        var body = new { title = $"  {new string('a', EventLimits.TitleMaxLength)}  ", date = Now.AddDays(7), maxCapacity = 10 };

        var response = await _client.PostAsJsonAsync("/api/events", body);

        var created = await ApiAssert.SuccessAsync<EventResponse>(response, HttpStatusCode.Created);
        Assert.Equal(EventLimits.TitleMaxLength, created.Title.Length);
    }

    [Fact]
    public async Task Create_WithDateInPast_ReturnsDomainValidationErrorInTheSameShape()
    {
        var body = NewEvent("Too late") with { Date = Now.AddMinutes(-1) };

        var errors = await ApiAssert.ValidationProblemAsync(await _client.PostAsJsonAsync("/api/events", body));

        Assert.Equal(["date"], errors.Keys);
        Assert.Equal([ValidationMessages.DateNotInFuture], errors["date"]);
    }

    [Theory]
    [InlineData("""{ "title": "T", "date": "2030-01-01T00:00:00Z", "maxCapacity": "thirty" }""", "maxCapacity", ValidationMessages.MaxCapacityInvalid)]
    [InlineData("""{ "title": "T", "date": "2030-01-01T00:00:00Z", "maxCapacity": "30" }""", "maxCapacity", ValidationMessages.MaxCapacityInvalid)]
    [InlineData("""{ "title": "T", "date": "2030-01-01T00:00:00Z", "maxCapacity": 30.5 }""", "maxCapacity", ValidationMessages.MaxCapacityInvalid)]
    [InlineData("""{ "title": "T", "date": "2030-01-01T00:00:00Z", "maxCapacity": 2147483648 }""", "maxCapacity", ValidationMessages.MaxCapacityInvalid)]
    [InlineData("""{ "Title": "T", "Date": "not a date", "MaxCapacity": 30 }""", "date", ValidationMessages.DateInvalid)]
    public async Task Create_WithValueOfWrongJsonType_ReportsAFieldSpecificMessageUnderTheFieldName(
        string json, string expectedKey, string expectedMessage)
    {
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var errors = await ApiAssert.ValidationProblemAsync(await _client.PostAsync("/api/events", content));

        Assert.Equal([expectedKey], errors.Keys);
        Assert.Equal([expectedMessage], errors[expectedKey]);
    }

    [Theory]
    [InlineData("""{ "title": "T", "date": "2030-01-01T00:00:00Z", "maxCapacity": 30""")] // cut off after the last value
    [InlineData("""{ "title": "T", "maxCapacity": 30, "date": "2030-01-01T00:00:00Z""")] // cut off inside a string
    public async Task Create_WithMalformedJson_ReportsTheGenericMessageRatherThanAFieldOne(string json)
    {
        // The reader reports these under the field it was in, but the field's value is fine.
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var errors = await ApiAssert.ValidationProblemAsync(await _client.PostAsync("/api/events", content));

        Assert.Equal(["The input was not valid."], errors.Values.SelectMany(messages => messages));
    }

    [Fact]
    public async Task Create_WithInvisibleTitleAndControlCharacter_ReportsThemTogetherWithTheOtherFieldErrors()
    {
        var body = new { title = "\u200B", description = "Ring the bell\u0007", date = Now.AddDays(1), maxCapacity = 0 };

        var errors = await ApiAssert.ValidationProblemAsync(await _client.PostAsJsonAsync("/api/events", body));

        Assert.Equal(["description", "maxCapacity", "title"], errors.Keys.Order());
        Assert.Equal([ValidationMessages.TitleRequired], errors["title"]);
        Assert.Equal([ValidationMessages.DescriptionInvalidCharacters], errors["description"]);
        Assert.Equal([ValidationMessages.MaxCapacityOutOfRange], errors["maxCapacity"]);
    }

    [Theory]
    [InlineData("2030-11-15T18:00:00")]
    [InlineData("2030-11-15T18:00")]
    [InlineData("2030-11-15")]
    public async Task Create_WithDateWithoutOffset_ReturnsValidationProblemForDate(string date)
    {
        var body = new { title = "T", date, maxCapacity = 30 };

        var errors = await ApiAssert.ValidationProblemAsync(await _client.PostAsJsonAsync("/api/events", body));

        Assert.Equal(["date"], errors.Keys);
        Assert.Equal([ValidationMessages.DateInvalid], errors["date"]);
    }

    [Fact]
    public async Task Create_WithDateWithOffset_StoresTheUtcInstant()
    {
        var body = new { title = "T", date = "2030-11-15T18:00:00-05:00", maxCapacity = 30 };

        var response = await _client.PostAsJsonAsync("/api/events", body);

        var created = await ApiAssert.SuccessAsync<EventResponse>(response, HttpStatusCode.Created);
        Assert.Equal(new DateTimeOffset(2030, 11, 15, 23, 0, 0, TimeSpan.Zero), created.Date);
        Assert.Equal(TimeSpan.Zero, created.Date.Offset);
    }

    [Fact]
    public async Task Create_WithNonJsonContentType_ReturnsUnsupportedMediaTypeProblem()
    {
        var content = new StringContent("title=Workshop", Encoding.UTF8, "text/plain");

        var response = await _client.PostAsync("/api/events", content);

        await ApiAssert.ProblemAsync(response, HttpStatusCode.UnsupportedMediaType, "unsupported_media_type");
    }

    [Fact]
    public async Task Update_AfterEventHasStarted_ReturnsConflictEventInPast()
    {
        var created = await CreateEventAsync(date: Now.AddHours(1));
        factory.Clock.Advance(TimeSpan.FromHours(2));
        var update = new UpdateEventRequest { Title = "Too late", Date = Now.AddDays(1), MaxCapacity = 10 };

        var response = await _client.PutAsJsonAsync($"/api/events/{created.Id}", update);

        var detail = await ApiAssert.DetailedProblemAsync(response, HttpStatusCode.Conflict, ErrorCodes.EventInPast);
        Assert.Equal("Past events can't be edited.", detail);
    }

    [Fact]
    public async Task Update_WithDateInPastAfterEventHasStarted_ReturnsValidationProblemRatherThanConflict()
    {
        var created = await CreateEventAsync(date: Now.AddHours(1));
        factory.Clock.Advance(TimeSpan.FromHours(2));
        var update = new UpdateEventRequest { Title = "Too late", Date = Now.AddDays(-1), MaxCapacity = 10 };

        var response = await _client.PutAsJsonAsync($"/api/events/{created.Id}", update);

        var errors = await ApiAssert.ValidationProblemAsync(response);
        Assert.Equal([ValidationMessages.DateNotInFuture], errors["date"]);
    }

    [Fact]
    public async Task Update_WithCapacityBelowRegistrations_ReturnsConflictCapacityBelowRegistrations()
    {
        // Arrange
        var created = await CreateEventAsync(maxCapacity: 5);
        foreach (var email in new[] { "ada@example.com", "grace@example.com", "alan@example.com" })
        {
            var registration = new CreateRegistrationRequest { Name = "Attendee", Email = email };
            var registered = await _client.PostAsJsonAsync($"/api/events/{created.Id}/registrations", registration);
            Assert.Equal(HttpStatusCode.Created, registered.StatusCode);
        }

        var update = new UpdateEventRequest { Title = created.Title, Date = created.Date, MaxCapacity = 2 };

        // Act
        var response = await _client.PutAsJsonAsync($"/api/events/{created.Id}", update);

        // Assert
        var detail = await ApiAssert.DetailedProblemAsync(response, HttpStatusCode.Conflict, ErrorCodes.CapacityBelowRegistrations);
        Assert.Equal("Max capacity can't be lower than the current number of registrations (3).", detail);
    }

    [Fact]
    public async Task Update_WhenEventDoesNotExist_ReturnsNotFoundProblem()
    {
        var update = new UpdateEventRequest { Title = "Ghost", Date = Now.AddDays(1), MaxCapacity = 10 };

        var response = await _client.PutAsJsonAsync($"/api/events/{Guid.NewGuid()}", update);

        await ApiAssert.ProblemAsync(response, HttpStatusCode.NotFound, ErrorCodes.EventNotFound);
    }

    [Fact]
    public async Task Delete_WhenEventDoesNotExist_ReturnsNotFoundProblem()
    {
        var response = await _client.DeleteAsync($"/api/events/{Guid.NewGuid()}");

        await ApiAssert.ProblemAsync(response, HttpStatusCode.NotFound, ErrorCodes.EventNotFound);
    }

    [Fact]
    public async Task GetById_WithMalformedId_ReturnsNotFoundProblem()
    {
        var response = await _client.GetAsync("/api/events/not-a-guid");

        await ApiAssert.ProblemAsync(response, HttpStatusCode.NotFound, "not_found");
    }

    [Fact]
    public async Task List_WithStatusSearchAndPaging_ReturnsRequestedPage()
    {
        // Arrange: a unique token keeps this test independent of events created by other tests.
        var token = Guid.NewGuid().ToString("N");
        await CreateEventAsync($"First {token}", date: Now.AddDays(1));
        await CreateEventAsync($"Second {token}", date: Now.AddDays(2));
        await CreateEventAsync($"Third {token}", date: Now.AddDays(3));

        // Act
        var response = await _client.GetAsync($"/api/events?status=UPCOMING&search={token.ToUpperInvariant()}&page=2&pageSize=2");

        // Assert
        var page = await ApiAssert.SuccessAsync<JsonElement>(response, HttpStatusCode.OK);
        Assert.Equal([$"Third {token}"], page.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("title").GetString()));
        Assert.Equal(2, page.GetProperty("page").GetInt32());
        Assert.Equal(2, page.GetProperty("pageSize").GetInt32());
        Assert.Equal(3, page.GetProperty("totalCount").GetInt32());
        Assert.Equal(2, page.GetProperty("totalPages").GetInt32());
    }

    [Theory]
    [InlineData("status=soon", "status")]
    [InlineData("page=0", "page")]
    [InlineData("page=abc", "page")]
    [InlineData("pageSize=0", "pageSize")]
    [InlineData("pageSize=101", "pageSize")]
    public async Task List_WithInvalidQueryParameter_ReturnsValidationProblemForIt(string query, string expectedKey)
    {
        var response = await _client.GetAsync($"/api/events?{query}");

        var errors = await ApiAssert.ValidationProblemAsync(response);
        Assert.Equal([expectedKey], errors.Keys);
    }

    [Fact]
    public async Task List_WithSearchLongerThanLimit_ReturnsValidationProblem()
    {
        var response = await _client.GetAsync($"/api/events?search={new string('x', EventListQuery.SearchMaxLength + 1)}");

        var errors = await ApiAssert.ValidationProblemAsync(response);
        Assert.Equal(["Search must be 100 characters or fewer."], errors["search"]);
    }

    private CreateEventRequest NewEvent(string title, DateTimeOffset? date = null, int maxCapacity = 25) =>
        new() { Title = title, Description = "An integration test event.", Date = date ?? Now.AddDays(7), MaxCapacity = maxCapacity };

    private async Task<EventResponse> CreateEventAsync(string title = "Test event", DateTimeOffset? date = null, int maxCapacity = 25)
    {
        var response = await _client.PostAsJsonAsync("/api/events", NewEvent(title, date, maxCapacity));
        return await ApiAssert.SuccessAsync<EventResponse>(response, HttpStatusCode.Created);
    }
}
