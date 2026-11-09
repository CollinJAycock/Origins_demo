using System.Text.Json;
using System.Text.Json.Serialization;

namespace EventManagement.Api.Infrastructure;

/// <summary>Rejects date-times without an offset, which the default converter would read in the server's time zone.</summary>
internal sealed class OffsetRequiredDateTimeOffsetConverter : JsonConverter<DateTimeOffset>
{
    // TryGetDateTime parses a value without an offset as DateTimeKind.Unspecified ("Z" gives Utc, "+01:00" Local).
    public override DateTimeOffset Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.TryGetDateTime(out var dateTime) && dateTime.Kind != DateTimeKind.Unspecified
            ? reader.GetDateTimeOffset()
            : throw new JsonException();

    public override void Write(Utf8JsonWriter writer, DateTimeOffset value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value);
}
