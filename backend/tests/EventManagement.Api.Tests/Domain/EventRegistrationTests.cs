using EventManagement.Api.Domain;
using EventManagement.Api.Tests.Support;
using static EventManagement.Api.Tests.Support.TestData;

namespace EventManagement.Api.Tests.Domain;

public sealed class EventRegistrationTests
{
    private const string EmailDomain = "@example.com";

    [Fact]
    public void Register_WithValidAttendee_TrimsInputAndTakesASpot()
    {
        var target = CreateEvent(maxCapacity: 3);

        var result = target.Register("  Ada Lovelace ", "  Ada@Example.com ", Now);

        ResultAssert.Success(result);
        Assert.Equal("Ada Lovelace", result.Value.Name);
        Assert.Equal("Ada@Example.com", result.Value.Email);
        Assert.Equal(target.Id, result.Value.EventId);
        Assert.Equal(Now, result.Value.RegisteredAt);
        var snapshot = target.Snapshot();
        Assert.Equal(1, snapshot.RegisteredCount);
        Assert.Equal(2, snapshot.AvailableSpots);
        Assert.False(snapshot.IsFull);
    }

    [Fact]
    public void Register_AfterEventHasStarted_ReturnsEventInPast()
    {
        var target = CreateEvent(date: Now.AddHours(1));

        var result = target.Register("Ada", "ada@example.com", Now.AddHours(2));

        var error = ResultAssert.Failure(result, ErrorCodes.EventInPast);
        Assert.Equal("Registration is closed because this event has already started.", error.Message);
    }

    [Fact]
    public void Register_AtExactStartTime_ReturnsEventInPast()
    {
        var start = Now.AddHours(1);
        var target = CreateEvent(date: start);

        var result = target.Register("Ada", "ada@example.com", start);

        ResultAssert.Failure(result, ErrorCodes.EventInPast);
    }

    [Fact]
    public void Register_JustBeforeStartTime_Succeeds()
    {
        var start = Now.AddHours(1);
        var target = CreateEvent(date: start);

        var result = target.Register("Ada", "ada@example.com", start.AddTicks(-1));

        ResultAssert.Success(result);
    }

    [Fact]
    public void Register_WhenEventIsFull_ReturnsEventFull()
    {
        var target = CreateEvent(maxCapacity: 2);
        Register(target, 1);
        Register(target, 2);

        var result = target.Register("Ada", "ada@example.com", Now);

        var error = ResultAssert.Failure(result, ErrorCodes.EventFull);
        Assert.Equal("This event is full (2 of 2 spots taken).", error.Message);
        Assert.Equal(2, target.Snapshot().RegisteredCount);
    }

    [Theory]
    [InlineData("ada@example.com")]
    [InlineData("ADA@EXAMPLE.COM")]
    [InlineData("  Ada@Example.com  ")]
    public void Register_WithAlreadyRegisteredEmail_ReturnsAlreadyRegistered(string email)
    {
        var target = CreateEvent();
        target.Register("Ada", "ada@example.com", Now);

        var result = target.Register("Ada again", email, Now);

        var error = ResultAssert.Failure(result, ErrorCodes.AlreadyRegistered);
        Assert.Equal($"{email.Trim()} is already registered for this event.", error.Message);
        Assert.Equal(1, target.Snapshot().RegisteredCount);
    }

    [Fact]
    public void Register_DuplicateEmailOnFullEvent_ReturnsAlreadyRegisteredRatherThanFull()
    {
        var target = CreateEvent(maxCapacity: 1);
        target.Register("Ada", "ada@example.com", Now);

        var result = target.Register("Ada", "ADA@example.com", Now);

        ResultAssert.Failure(result, ErrorCodes.AlreadyRegistered);
    }

    [Theory]
    [InlineData("ada@bücher.example", "ADA@xn--bcher-kva.example")]
    [InlineData("ada@xn--bcher-kva.example", "Ada@Bücher.example")]
    public void Register_WithSameAddressInUnicodeOrPunycode_ReturnsAlreadyRegistered(string registeredEmail, string email)
    {
        var target = CreateEvent();
        ResultAssert.Success(target.Register("Ada", registeredEmail, Now));

        var result = target.Register("Ada again", email, Now);

        var error = ResultAssert.Failure(result, ErrorCodes.AlreadyRegistered);
        Assert.Equal($"{email} is already registered for this event.", error.Message);
    }

    [Fact]
    public void Register_DuplicateEmailOnFullPastEvent_ReturnsEventInPastFirst()
    {
        var target = CreateEvent(maxCapacity: 1, date: Now.AddHours(1));
        target.Register("Ada", "ada@example.com", Now);

        var result = target.Register("Ada", "ada@example.com", Now.AddHours(2));

        ResultAssert.Failure(result, ErrorCodes.EventInPast);
    }

    [Fact]
    public void Register_InvalidEmailOnFullPastEvent_ReportsValidationErrorFirst()
    {
        var target = CreateEvent(maxCapacity: 1, date: Now.AddHours(1));
        Register(target, 1);

        var result = target.Register("Ada", "not-an-email", Now.AddHours(2));

        ResultAssert.ValidationFailure(result, nameof(Registration.Email), ValidationMessages.EmailInvalid);
    }

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("ada@")]
    [InlineData("Ada <ada@example.com>")]
    [InlineData("ada\u200B@example.com")] // zero-width space
    [InlineData("a\u00ADda@example.com")] // soft hyphen
    [InlineData("\uFEFFada@example.com")] // byte order mark
    [InlineData("ada\u202E@example.com")] // right-to-left override
    [InlineData("ada\u00A0@example.com")] // no-break space
    [InlineData("\"ada\"@example.com")] // quoted local part
    [InlineData("ada@example.com.")] // trailing dot on the domain
    [InlineData("ada@-example.com")] // not a valid domain name
    [InlineData("ada\u034F@example.com")] // combining grapheme joiner
    [InlineData("ada\uFE0F@example.com")] // variation selector
    [InlineData("ada\U000E0100@example.com")] // variation selector outside the BMP
    [InlineData("ada\u3164@example.com")] // Hangul filler
    [InlineData("ada\u2800@example.com")] // blank Braille pattern
    public void Register_WithInvalidEmail_ReturnsEmailInvalid(string email)
    {
        var target = CreateEvent();

        var result = target.Register("Ada", email, Now);

        ResultAssert.ValidationFailure(result, nameof(Registration.Email), ValidationMessages.EmailInvalid);
    }

    [Fact]
    public void Register_WithEmailLongerThanLimit_ReturnsEmailTooLong()
    {
        var target = CreateEvent();
        var email = new string('a', RegistrationLimits.EmailMaxLength + 1 - EmailDomain.Length) + EmailDomain;

        var result = target.Register("Ada", email, Now);

        ResultAssert.ValidationFailure(result, nameof(Registration.Email), ValidationMessages.EmailTooLong);
    }

    [Fact]
    public void Register_WithEmailAtLimit_Succeeds()
    {
        var target = CreateEvent();
        var email = new string('a', RegistrationLimits.EmailMaxLength - EmailDomain.Length) + EmailDomain;

        var result = target.Register("Ada", email, Now);

        ResultAssert.Success(result);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\u200B")] // zero-width space
    [InlineData(" \u00AD\uFEFF ")] // soft hyphen and byte order mark
    [InlineData("\u3164")] // Hangul filler
    [InlineData("\u2800")] // blank Braille pattern
    [InlineData("\uFE0F")] // a lone variation selector
    public void Register_WithBlankName_ReturnsNameRequired(string name)
    {
        var target = CreateEvent();

        var result = target.Register(name, "ada@example.com", Now);

        ResultAssert.ValidationFailure(result, nameof(Registration.Name), ValidationMessages.NameRequired);
    }

    [Theory]
    [InlineData("Ada\tLovelace")]
    [InlineData("Ada\nLovelace")]
    [InlineData("Ada \u202ELovelace")] // right-to-left override
    public void Register_WithControlCharacterInName_ReturnsNameInvalidCharacters(string name)
    {
        var target = CreateEvent();

        var result = target.Register(name, "ada@example.com", Now);

        ResultAssert.ValidationFailure(result, nameof(Registration.Name), ValidationMessages.NameInvalidCharacters);
    }

    [Fact]
    public void Register_WithNameLongerThanLimit_ReturnsNameTooLong()
    {
        var target = CreateEvent();

        var result = target.Register(new string('n', RegistrationLimits.NameMaxLength + 1), "ada@example.com", Now);

        ResultAssert.ValidationFailure(result, nameof(Registration.Name), ValidationMessages.NameTooLong);
    }

    [Fact]
    public void Register_WithNameAtLimit_Succeeds()
    {
        var target = CreateEvent();

        var result = target.Register(new string('n', RegistrationLimits.NameMaxLength), "ada@example.com", Now);

        ResultAssert.Success(result);
    }

    [Fact]
    public void Unregister_ExistingRegistration_FreesTheSpot()
    {
        var target = CreateEvent(maxCapacity: 1);
        var registration = Register(target, 1);

        var result = target.Unregister(registration.Id, Now);

        ResultAssert.Success(result);
        Assert.Equal(0, target.Snapshot().RegisteredCount);
        Assert.Null(target.FindRegistration(registration.Id));
        ResultAssert.Success(target.Register("Grace", "grace@example.com", Now));
    }

    [Fact]
    public void Unregister_ThenRegisterWithSameEmail_Succeeds()
    {
        var target = CreateEvent();
        var registration = target.Register("Ada", "ada@example.com", Now).Value;
        target.Unregister(registration.Id, Now);

        var result = target.Register("Ada", "ADA@example.com", Now);

        ResultAssert.Success(result);
    }

    [Fact]
    public void Unregister_UnknownRegistration_ReturnsRegistrationNotFound()
    {
        var target = CreateEvent();
        var unknownId = Guid.NewGuid();

        var result = target.Unregister(unknownId, Now);

        var error = ResultAssert.Failure(result, ErrorCodes.RegistrationNotFound);
        Assert.Equal($"Registration '{unknownId}' was not found for this event.", error.Message);
    }

    [Fact]
    public void Unregister_AfterEventHasStarted_ReturnsEventInPastAndKeepsRegistration()
    {
        var target = CreateEvent(date: Now.AddHours(1));
        var registration = Register(target, 1);

        var result = target.Unregister(registration.Id, Now.AddHours(2));

        var error = ResultAssert.Failure(result, ErrorCodes.EventInPast);
        Assert.Equal("Registrations for past events can no longer be changed.", error.Message);
        Assert.Equal(1, target.Snapshot().RegisteredCount);
    }

    [Fact]
    public void GetRegistrations_WhenAddedOutOfOrder_ReturnsThemOldestFirst()
    {
        var target = CreateEvent();
        var late = Register(target, 1, Now.AddMinutes(30));
        var early = Register(target, 2, Now.AddMinutes(10));
        var middle = Register(target, 3, Now.AddMinutes(20));

        var registrations = target.GetRegistrations();

        Assert.Equal([early.Id, middle.Id, late.Id], registrations.Select(registration => registration.Id));
    }

    [Fact]
    public void FindRegistration_WithKnownId_ReturnsRegistration()
    {
        var target = CreateEvent();
        var registration = Register(target, 1);

        var found = target.FindRegistration(registration.Id);

        Assert.Equal(registration, found);
    }
}
