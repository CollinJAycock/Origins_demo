using System.Net;
using System.Net.Http.Json;
using EventManagement.Api.Contracts;
using EventManagement.Api.Domain;

namespace EventManagement.Api.Tests.Api;

public sealed class RegistrationsApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    private DateTimeOffset Now => factory.Clock.GetUtcNow();

    [Fact]
    public async Task RegistrationLifecycle_RegisterReadListUnregister_ReturnsExpectedResponses()
    {
        var eventId = await CreateEventAsync(maxCapacity: 10);

        // Register
        var registerResponse = await RegisterAsync(eventId, " Ada Lovelace ", " ada@example.com ");
        var registration = await ApiAssert.SuccessAsync<RegistrationResponse>(registerResponse, HttpStatusCode.Created);
        Assert.Equal($"/api/events/{eventId}/registrations/{registration.Id}", registerResponse.Headers.Location?.AbsolutePath);
        Assert.Equal("Ada Lovelace", registration.Name);
        Assert.Equal("ada@example.com", registration.Email);
        Assert.Equal(Now, registration.RegisteredAt);

        // Read, via the Location header, and list
        Assert.Equal(registration, await _client.GetFromJsonAsync<RegistrationResponse>(registerResponse.Headers.Location));
        Assert.Equal([registration], await ListRegistrationsAsync(eventId));
        Assert.Equal(1, (await GetEventAsync(eventId)).RegisteredCount);

        // Unregister
        var unregisterResponse = await _client.DeleteAsync($"/api/events/{eventId}/registrations/{registration.Id}");
        Assert.Equal(HttpStatusCode.NoContent, unregisterResponse.StatusCode);
        await ApiAssert.ProblemAsync(
            await _client.GetAsync(registerResponse.Headers.Location), HttpStatusCode.NotFound, ErrorCodes.RegistrationNotFound);
        Assert.Equal(0, (await GetEventAsync(eventId)).RegisteredCount);
    }

    [Fact]
    public async Task List_ReturnsRegistrationsOldestFirst()
    {
        var eventId = await CreateEventAsync();
        foreach (var email in new[] { "first@example.com", "second@example.com", "third@example.com" })
        {
            Assert.Equal(HttpStatusCode.Created, (await RegisterAsync(eventId, "Attendee", email)).StatusCode);
            factory.Clock.Advance(TimeSpan.FromMinutes(1));
        }

        var registrations = await ListRegistrationsAsync(eventId);

        Assert.Equal(["first@example.com", "second@example.com", "third@example.com"], registrations.Select(registration => registration.Email));
    }

    [Fact]
    public async Task Register_WhenEventIsFull_ReturnsConflictEventFull()
    {
        var eventId = await CreateEventAsync(maxCapacity: 1);
        await RegisterAsync(eventId, "Ada", "ada@example.com");

        var response = await RegisterAsync(eventId, "Grace", "grace@example.com");

        var detail = await ApiAssert.DetailedProblemAsync(response, HttpStatusCode.Conflict, ErrorCodes.EventFull);
        Assert.Equal("This event is full (1 of 1 spots taken).", detail);
    }

    [Fact]
    public async Task Register_WithEmailAlreadyRegistered_ReturnsConflictAlreadyRegistered()
    {
        var eventId = await CreateEventAsync();
        await RegisterAsync(eventId, "Ada", "ada@example.com");

        var response = await RegisterAsync(eventId, "Ada again", "  ADA@example.com ");

        var detail = await ApiAssert.DetailedProblemAsync(response, HttpStatusCode.Conflict, ErrorCodes.AlreadyRegistered);
        Assert.Equal("ADA@example.com is already registered for this event.", detail);
    }

    [Fact]
    public async Task Register_AfterEventHasStarted_ReturnsConflictEventInPast()
    {
        var eventId = await CreateEventAsync(date: Now.AddHours(1));
        factory.Clock.Advance(TimeSpan.FromHours(1));

        var response = await RegisterAsync(eventId, "Ada", "ada@example.com");

        var detail = await ApiAssert.DetailedProblemAsync(response, HttpStatusCode.Conflict, ErrorCodes.EventInPast);
        Assert.Equal("Registration is closed because this event has already started.", detail);
    }

    [Theory]
    [InlineData("Ada", "Ada <ada@example.com>", "email", ValidationMessages.EmailInvalid)]
    [InlineData("Ada \u202ELovelace", "ada@example.com", "name", ValidationMessages.NameInvalidCharacters)]
    public async Task Register_WithInvalidFieldAfterEventHasStarted_ReturnsValidationProblemRatherThanConflict(
        string name, string email, string field, string message)
    {
        var eventId = await CreateEventAsync(date: Now.AddHours(1));
        factory.Clock.Advance(TimeSpan.FromHours(1));

        var response = await RegisterAsync(eventId, name, email);

        var errors = await ApiAssert.ValidationProblemAsync(response);
        Assert.Equal([field], errors.Keys);
        Assert.Equal([message], errors[field]);
    }

    [Fact]
    public async Task Register_WithInvisibleNameWhenEventIsFull_ReturnsValidationProblemRatherThanConflict()
    {
        var eventId = await CreateEventAsync(maxCapacity: 1);
        await RegisterAsync(eventId, "Ada", "ada@example.com");

        var response = await RegisterAsync(eventId, "\u200B", "grace@example.com");

        var errors = await ApiAssert.ValidationProblemAsync(response);
        Assert.Equal([ValidationMessages.NameRequired], errors["name"]);
    }

    [Fact]
    public async Task Unregister_AfterEventHasStarted_ReturnsConflictEventInPast()
    {
        var eventId = await CreateEventAsync(date: Now.AddHours(1));
        var registration = await ApiAssert.SuccessAsync<RegistrationResponse>(
            await RegisterAsync(eventId, "Ada", "ada@example.com"), HttpStatusCode.Created);
        factory.Clock.Advance(TimeSpan.FromHours(2));

        var response = await _client.DeleteAsync($"/api/events/{eventId}/registrations/{registration.Id}");

        var detail = await ApiAssert.DetailedProblemAsync(response, HttpStatusCode.Conflict, ErrorCodes.EventInPast);
        Assert.Equal("Registrations for past events can no longer be changed.", detail);
    }

    [Theory]
    [InlineData("  ", "not-an-email")]
    [InlineData("  ", "Ada <ada@example.com>")] // parses as an address, but isn't a bare one
    [InlineData("\u200B", "not-an-email")] // blank by the domain's rule, which model validation applies too
    public async Task Register_WithInvalidFields_ReturnsValidationProblemKeyedByJsonNames(string name, string email)
    {
        var eventId = await CreateEventAsync();

        var response = await RegisterAsync(eventId, name, email);

        var errors = await ApiAssert.ValidationProblemAsync(response);
        Assert.Equal(["email", "name"], errors.Keys.Order());
        Assert.Equal([ValidationMessages.NameRequired], errors["name"]);
        Assert.Equal([ValidationMessages.EmailInvalid], errors["email"]);
    }

    [Fact]
    public async Task Register_WithPaddedNameAtLimit_AppliesTheLimitAfterTrimming()
    {
        var eventId = await CreateEventAsync();

        var response = await RegisterAsync(eventId, $"  {new string('n', RegistrationLimits.NameMaxLength)}  ", "ada@example.com");

        var registration = await ApiAssert.SuccessAsync<RegistrationResponse>(response, HttpStatusCode.Created);
        Assert.Equal(RegistrationLimits.NameMaxLength, registration.Name.Length);
    }

    [Fact]
    public async Task Register_ForUnknownEvent_ReturnsNotFoundEventNotFound()
    {
        var response = await RegisterAsync(Guid.NewGuid(), "Ada", "ada@example.com");

        await ApiAssert.ProblemAsync(response, HttpStatusCode.NotFound, ErrorCodes.EventNotFound);
    }

    [Fact]
    public async Task List_ForUnknownEvent_ReturnsNotFoundEventNotFound()
    {
        var response = await _client.GetAsync($"/api/events/{Guid.NewGuid()}/registrations");

        await ApiAssert.ProblemAsync(response, HttpStatusCode.NotFound, ErrorCodes.EventNotFound);
    }

    [Fact]
    public async Task GetById_WithUnknownRegistration_ReturnsNotFoundRegistrationNotFound()
    {
        var eventId = await CreateEventAsync();
        var unknownId = Guid.NewGuid();

        var response = await _client.GetAsync($"/api/events/{eventId}/registrations/{unknownId}");

        var detail = await ApiAssert.DetailedProblemAsync(response, HttpStatusCode.NotFound, ErrorCodes.RegistrationNotFound);
        Assert.Equal($"Registration '{unknownId}' was not found for this event.", detail);
    }

    [Fact]
    public async Task Unregister_WithUnknownRegistration_ReturnsNotFoundRegistrationNotFound()
    {
        var eventId = await CreateEventAsync();

        var response = await _client.DeleteAsync($"/api/events/{eventId}/registrations/{Guid.NewGuid()}");

        await ApiAssert.ProblemAsync(response, HttpStatusCode.NotFound, ErrorCodes.RegistrationNotFound);
    }

    [Fact]
    public async Task Register_ManyConcurrentRequests_NeverExceedsCapacity()
    {
        // Arrange
        const int capacity = 5;
        var eventId = await CreateEventAsync(maxCapacity: capacity);

        // Act
        var responses = await Task.WhenAll(Enumerable.Range(0, 25)
            .Select(i => RegisterAsync(eventId, $"Attendee {i}", $"attendee{i}@example.com")));

        // Assert
        Assert.Equal(capacity, responses.Count(response => response.StatusCode == HttpStatusCode.Created));
        Assert.All(responses.Where(response => response.StatusCode != HttpStatusCode.Created),
            response => Assert.Equal(HttpStatusCode.Conflict, response.StatusCode));
        Assert.Equal(capacity, (await GetEventAsync(eventId)).RegisteredCount);
    }

    // Not CreateRegistrationRequest: its init accessors would trim the values before they are sent.
    private Task<HttpResponseMessage> RegisterAsync(Guid eventId, string name, string email) =>
        _client.PostAsJsonAsync($"/api/events/{eventId}/registrations", new { name, email });

    private async Task<Guid> CreateEventAsync(int maxCapacity = 10, DateTimeOffset? date = null)
    {
        var request = new CreateEventRequest { Title = "Registration test", Date = date ?? Now.AddDays(7), MaxCapacity = maxCapacity };
        var created = await ApiAssert.SuccessAsync<EventResponse>(await _client.PostAsJsonAsync("/api/events", request), HttpStatusCode.Created);
        return created.Id;
    }

    private async Task<EventResponse> GetEventAsync(Guid eventId) =>
        await ApiAssert.SuccessAsync<EventResponse>(await _client.GetAsync($"/api/events/{eventId}"), HttpStatusCode.OK);

    private async Task<RegistrationResponse[]> ListRegistrationsAsync(Guid eventId) =>
        await ApiAssert.SuccessAsync<RegistrationResponse[]>(await _client.GetAsync($"/api/events/{eventId}/registrations"), HttpStatusCode.OK);
}
