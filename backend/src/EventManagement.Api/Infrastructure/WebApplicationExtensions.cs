using EventManagement.Api.Persistence;

namespace EventManagement.Api.Infrastructure;

/// <summary>Request pipeline and startup steps used by <c>Program.cs</c>.</summary>
internal static class WebApplicationExtensions
{
    /// <summary>
    /// When <c>OpenApi:Enabled</c> is true (the default in Development only), serves the OpenAPI document at
    /// <c>/openapi/v1.json</c> and Swagger UI at <c>/swagger</c>, and sends <c>/</c> to the UI.
    /// </summary>
    public static WebApplication UseApiDocumentationIfEnabled(this WebApplication app)
    {
        if (app.Configuration.GetValue<bool>("OpenApi:Enabled"))
        {
            app.MapOpenApi();
            app.UseSwaggerUI(options =>
            {
                options.SwaggerEndpoint("/openapi/v1.json", "Event Management API v1");
                options.DocumentTitle = "Event Management API";
            });
            app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();
        }

        return app;
    }

    /// <summary>Adds the demo events when <c>Seeding:Enabled</c> is true (the default in Development only).</summary>
    public static WebApplication SeedDemoDataIfEnabled(this WebApplication app)
    {
        if (app.Configuration.GetValue<bool>("Seeding:Enabled"))
        {
            app.Services.GetRequiredService<DataSeeder>().Seed();
        }

        return app;
    }
}
