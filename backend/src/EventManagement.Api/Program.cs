using EventManagement.Api.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddWebApi(builder.Configuration)
    .AddEventManagement();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseCors(ServiceCollectionExtensions.FrontendCorsPolicy);
app.UseApiDocumentationIfEnabled();

app.MapControllers();
app.MapHealthChecks("/health");

app.SeedDemoDataIfEnabled();
app.Run();
