using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EventManagement.Api.Contracts;
using EventManagement.Api.Controllers;
using EventManagement.Api.Domain;
using EventManagement.Api.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace EventManagement.Api.Tests.Api;

/// <summary>
/// Cross-cutting behavior: health, framework-generated problems, the request size limit, OpenAPI, host filtering,
/// CORS and startup configuration.
/// </summary>
public sealed class PlatformApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Health_ReturnsHealthy()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task List_WithSeedingDisabled_StartsEmpty()
    {
        var page = await _client.GetFromJsonAsync<PagedResponse<EventResponse>>("/api/events");

        Assert.NotNull(page);
        Assert.Empty(page.Items);
        Assert.Equal(0, page.TotalCount);
    }

    [Fact]
    public async Task UnknownRoute_ReturnsNotFoundProblemWithCode()
    {
        var response = await _client.GetAsync("/api/does-not-exist");

        await ApiAssert.ProblemAsync(response, HttpStatusCode.NotFound, "not_found");
    }

    [Fact]
    public async Task UnsupportedMethod_ReturnsMethodNotAllowedProblemWithCode()
    {
        var response = await _client.PatchAsync($"/api/events/{Guid.NewGuid()}", JsonContent.Create(new { }));

        await ApiAssert.ProblemAsync(response, HttpStatusCode.MethodNotAllowed, "method_not_allowed");
    }

    [Fact]
    public async Task UnhandledException_ReturnsInternalServerErrorProblemWithoutExceptionDetails()
    {
        // Arrange
        using var failingApi = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.Replace(ServiceDescriptor.Singleton<IEventRepository, ThrowingEventRepository>())));
        using var client = failingApi.CreateClient();

        // Act
        var response = await client.GetAsync("/api/events");

        // Assert
        var problem = await ApiAssert.ProblemAsync(response, HttpStatusCode.InternalServerError, "internal_server_error");
        Assert.DoesNotContain(ThrowingEventRepository.Message, problem.GetRawText());
        Assert.DoesNotContain(nameof(ThrowingEventRepository), problem.GetRawText());
    }

    [Fact]
    public async Task Request_WithBodyOverTheSizeLimit_ReturnsPayloadTooLargeProblemWithoutLoggingAnError()
    {
        // Arrange: TestServer doesn't enforce request body size limits, so this test runs the API on Kestrel.
        var errorLog = new ErrorLog();
        using var kestrelApi = factory.WithWebHostBuilder(builder =>
            builder.ConfigureLogging(logging => logging.AddProvider(errorLog)));
        kestrelApi.UseKestrel(0);
        using var client = kestrelApi.CreateClient();
        var body = new { title = new string('a', ApiControllerBase.MaxRequestBodySize), date = "2030-11-15T18:00:00Z", maxCapacity = 10 };

        // Act
        var response = await client.PostAsJsonAsync("/api/events", body);

        // Assert
        await ApiAssert.ProblemAsync(response, HttpStatusCode.RequestEntityTooLarge, "payload_too_large");
        Assert.Empty(errorLog.Messages);
    }

    [Fact]
    public async Task OpenApiDocument_DescribesEveryEndpoint()
    {
        string[] expectedPaths =
        [
            "/api/events",
            "/api/events/{eventId}/registrations",
            "/api/events/{eventId}/registrations/{registrationId}",
            "/api/events/{id}",
        ];

        var document = await _client.GetFromJsonAsync<JsonElement>("/openapi/v1.json");

        var paths = document.GetProperty("paths");
        Assert.Equal(expectedPaths, paths.EnumerateObject().Select(path => path.Name).Order(StringComparer.Ordinal));
        Assert.All(paths.EnumerateObject().SelectMany(path => path.Value.EnumerateObject()),
            operation => Assert.False(string.IsNullOrWhiteSpace(operation.Value.GetProperty("summary").GetString())));
    }

    [Fact]
    public async Task OpenApiDocument_DescribesTheSizeAndMediaTypeProblemsOfEveryRequestWithABody()
    {
        var document = await _client.GetFromJsonAsync<JsonElement>("/openapi/v1.json");

        var operationsWithBody = document.GetProperty("paths").EnumerateObject()
            .SelectMany(
                path => path.Value.EnumerateObject(),
                (path, operation) => (Name: $"{operation.Name.ToUpperInvariant()} {path.Name}", Operation: operation.Value))
            .Where(entry => entry.Operation.TryGetProperty("requestBody", out _))
            .ToList();

        Assert.Equal(
            ["POST /api/events", "POST /api/events/{eventId}/registrations", "PUT /api/events/{id}"],
            operationsWithBody.Select(entry => entry.Name).Order(StringComparer.Ordinal));
        Assert.All(operationsWithBody, entry =>
        {
            var responses = entry.Operation.GetProperty("responses");
            Assert.True(responses.TryGetProperty("413", out _), $"{entry.Name} doesn't document 413.");
            Assert.True(responses.TryGetProperty("415", out _), $"{entry.Name} doesn't document 415.");
        });
    }

    [Fact]
    public async Task ApiDocumentation_WhenEnabledOutsideDevelopment_IsServed()
    {
        // Arrange: how docker-compose runs the API.
        using var productionApi = factory.WithWebHostBuilder(builder => builder
            .UseEnvironment(Environments.Production)
            .UseSetting("OpenApi:Enabled", "true"));
        using var client = productionApi.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        // Act
        var document = await client.GetAsync("/openapi/v1.json");
        var swaggerUi = await client.GetAsync("/swagger/index.html");
        var root = await client.GetAsync("/");

        // Assert
        Assert.Equal(HttpStatusCode.OK, document.StatusCode);
        Assert.Equal(HttpStatusCode.OK, swaggerUi.StatusCode);
        Assert.Equal("/swagger", root.Headers.Location?.OriginalString);
    }

    [Theory]
    [InlineData("/openapi/v1.json")]
    [InlineData("/swagger/index.html")]
    [InlineData("/")]
    public async Task ApiDocumentation_OutsideDevelopmentByDefault_IsNotServed(string path)
    {
        using var productionApi = factory.WithWebHostBuilder(builder => builder.UseEnvironment(Environments.Production));
        using var client = productionApi.CreateClient();

        var response = await client.GetAsync(path);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("localhost")]
    [InlineData("localhost:8080")]
    [InlineData("127.0.0.1:5080")]
    [InlineData("[::1]:5080")]
    public async Task Request_ForLocalHostName_IsServed(string host)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/events");
        request.Headers.Host = host;

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData("attacker.example")]
    [InlineData("attacker.example:8080")]
    public async Task Request_ForAnyOtherHostName_IsRejected(string host)
    {
        // What a DNS-rebinding page sends after pointing its own host name at this machine.
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/events");
        request.Headers.Host = host;

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CorsPreflight_FromFrontendOrigin_IsAllowedAndExposesLocation()
    {
        using var preflight = new HttpRequestMessage(HttpMethod.Options, "/api/events");
        preflight.Headers.Add("Origin", "http://localhost:5173");
        preflight.Headers.Add("Access-Control-Request-Method", "POST");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/events");
        request.Headers.Add("Origin", "http://localhost:5173");

        var preflightResponse = await _client.SendAsync(preflight);
        var response = await _client.SendAsync(request);

        Assert.Equal(["http://localhost:5173"], preflightResponse.Headers.GetValues("Access-Control-Allow-Origin"));
        Assert.Equal(["Location"], response.Headers.GetValues("Access-Control-Expose-Headers"));
    }

    [Fact]
    public async Task Cors_FromUnknownOrigin_IsNotAllowed()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/events");
        request.Headers.Add("Origin", "https://attacker.example");

        var response = await _client.SendAsync(request);

        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    private sealed class ThrowingEventRepository : IEventRepository
    {
        public const string Message = "Simulated storage failure with internal details";

        public Event? GetById(Guid id) => throw new InvalidOperationException(Message);

        public IReadOnlyList<Event> GetAll() => throw new InvalidOperationException(Message);

        public void Add(Event newEvent) => throw new InvalidOperationException(Message);

        public bool Remove(Guid id) => throw new InvalidOperationException(Message);
    }

    // Collects the messages of error-level log entries.
    private sealed class ErrorLog : ILoggerProvider, ILogger
    {
        public ConcurrentQueue<string> Messages { get; } = new();

        public ILogger CreateLogger(string categoryName) => this;

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Error;

        public void Log<TState>(
            LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (IsEnabled(logLevel))
            {
                Messages.Enqueue(formatter(state, exception));
            }
        }

        public void Dispose()
        {
        }
    }
}
