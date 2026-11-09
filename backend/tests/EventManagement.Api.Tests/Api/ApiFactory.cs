using EventManagement.Api.Tests.Support;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Time.Testing;

namespace EventManagement.Api.Tests.Api;

/// <summary>Hosts the real API in memory, with demo data disabled and a clock the tests control.</summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    /// <summary>The API's clock. Tests date their events relative to it and advance it to make events past.</summary>
    public FakeTimeProvider Clock { get; } = new(TestData.Now);

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("Seeding:Enabled", "false");
        builder.ConfigureTestServices(services => services.Replace(ServiceDescriptor.Singleton<TimeProvider>(Clock)));
    }
}
