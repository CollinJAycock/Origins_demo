using System.Text.Json;
using System.Text.Json.Serialization;
using EventManagement.Api.Persistence;
using EventManagement.Api.Services;
using Microsoft.AspNetCore.Mvc.ModelBinding.Metadata;
using Microsoft.Net.Http.Headers;

namespace EventManagement.Api.Infrastructure;

/// <summary>Service registration, grouped so that <c>Program.cs</c> reads as a table of contents.</summary>
internal static class ServiceCollectionExtensions
{
    /// <summary>The CORS policy that lets the browser frontend call the API.</summary>
    public const string FrontendCorsPolicy = "Frontend";

    /// <summary>Registers the clock, the in-memory store, the application services and the demo data seeder.</summary>
    public static IServiceCollection AddEventManagement(this IServiceCollection services)
    {
        // Everything is stateless or guards its own state, so singletons are safe and avoid per-request allocations.
        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<IEventRepository, InMemoryEventRepository>();
        services.AddSingleton<IEventService, EventService>();
        services.AddSingleton<IRegistrationService, RegistrationService>();
        services.AddSingleton<DataSeeder>();
        return services;
    }

    /// <summary>Registers the HTTP layer: controllers and validation, problem details, OpenAPI, CORS and health checks.</summary>
    public static IServiceCollection AddWebApi(this IServiceCollection services, IConfiguration configuration)
    {
        services
            .AddControllers(options =>
            {
                // Key validation errors by JSON property name ("maxCapacity"), the names clients actually send.
                options.ModelMetadataDetailsProviders.Add(new SystemTextJsonValidationMetadataProvider());

                // Contracts declare required members explicitly ([Required] on nullable properties). The implicit
                // rule would only add a redundant "The request field is required." when a body fails to parse.
                options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
            })
            .AddJsonOptions(options =>
            {
                ConfigureJson(options.JsonSerializerOptions);

                // MVC only, not in ConfigureJson: that also feeds the options the OpenAPI generator reads, where a
                // custom converter would drop "type: string" from every date-time in the document.
                options.JsonSerializerOptions.Converters.Add(new OffsetRequiredDateTimeOffsetConverter());

                // Report malformed JSON as "The input was not valid." rather than leaking serializer and type names.
                options.AllowInputFormatterExceptionMessages = false;
            })
            .ConfigureApiBehaviorOptions(options =>
            {
                // Some fields have clearer wording for a value that can't be converted; apply it before the
                // default response is built from the model state.
                var createDefaultResponse = options.InvalidModelStateResponseFactory;
                options.InvalidModelStateResponseFactory = context =>
                {
                    ProblemDetailsConventions.DescribeConversionErrors(context.ModelState);
                    return createDefaultResponse(context);
                };
            });

        // The OpenAPI generator builds schemas from the minimal-API JSON options, so mirror the settings there.
        services.ConfigureHttpJsonOptions(options => ConfigureJson(options.SerializerOptions));

        services.AddProblemDetails(options => options.CustomizeProblemDetails = ProblemDetailsConventions.Apply);

        // The server reports bad requests, such as a body over the size limit, by throwing BadHttpRequestException.
        // They are the client's fault: answer with the status it carries (413 for that one) instead of a 500, and
        // don't log them as unhandled errors.
        services.AddExceptionHandler(options =>
        {
            options.StatusCodeSelector = exception =>
                exception is BadHttpRequestException badRequest ? badRequest.StatusCode : StatusCodes.Status500InternalServerError;
            options.SuppressDiagnosticsCallback = context => context.Exception is BadHttpRequestException;
        });

        services.AddOpenApi(options => options.AddDocumentTransformer((document, _, _) =>
        {
            document.Info.Title = "Event Management API";
            document.Info.Description =
                "Manage events and attendee registrations. Errors are RFC 9457 problem details that always include "
                + "a machine-readable `code` and a `traceId`; validation errors are keyed by JSON field name.";
            return Task.CompletedTask;
        }));

        var allowedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        services.AddCors(options => options.AddPolicy(FrontendCorsPolicy, policy => policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .WithExposedHeaders(HeaderNames.Location)));

        services.AddHealthChecks();
        return services;
    }

    // Numbers must be JSON numbers ("maxCapacity": 30, not "30"). The web defaults also accept numeric strings,
    // which would make every integer in the OpenAPI document read "integer or string".
    private static void ConfigureJson(JsonSerializerOptions options) => options.NumberHandling = JsonNumberHandling.Strict;
}
