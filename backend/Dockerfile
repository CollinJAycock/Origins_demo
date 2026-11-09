# syntax=docker/dockerfile:1

# Build: restore first (cached until the project file changes), then publish.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY nuget.config ./
COPY src/EventManagement.Api/EventManagement.Api.csproj src/EventManagement.Api/
RUN dotnet restore src/EventManagement.Api/EventManagement.Api.csproj
COPY src/EventManagement.Api/ src/EventManagement.Api/
RUN dotnet publish src/EventManagement.Api/EventManagement.Api.csproj -c Release -o /app --no-restore

# Run: ASP.NET Core runtime only, as the image's non-root user, listening on port 8080.
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app ./
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "EventManagement.Api.dll"]
