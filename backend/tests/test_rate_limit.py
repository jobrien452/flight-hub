from app.models.user import User
from app.rate_limit import RateLimiter


def test_a_limiter_lets_the_allowance_through_and_no_more():
    limiter = RateLimiter(limit=3, window_seconds=60)

    assert [limiter.allow("someone", now=0) for _ in range(4)] == [True, True, True, False]


def test_a_limiter_forgets_once_the_window_has_passed():
    limiter = RateLimiter(limit=1, window_seconds=60)
    limiter.allow("someone", now=0)

    assert limiter.allow("someone", now=30) is False
    assert limiter.allow("someone", now=61) is True


def test_one_caller_running_out_does_not_stop_another():
    limiter = RateLimiter(limit=1, window_seconds=60)
    limiter.allow("first", now=0)

    assert limiter.allow("second", now=0) is True


def test_a_limiter_does_not_hoard_keys_it_is_done_with():
    limiter = RateLimiter(limit=1, window_seconds=60)
    limiter.allow("someone", now=0)
    limiter.allow("someone", now=120)

    assert limiter.tracked_keys() == 1


async def test_guessing_a_password_gets_shut_off(client, pilot_user: User):
    attempts = [
        await client.post(
            "/auth/login", json={"email": pilot_user.email, "password": f"guess-{i}"}
        )
        for i in range(12)
    ]

    codes = [a.status_code for a in attempts]
    assert 401 in codes
    assert 429 in codes
    # the door shuts and stays shut rather than reopening on the next try
    assert codes[-1] == 429
    assert attempts[-1].headers.get("retry-after") is not None


async def test_the_right_password_still_gets_in_before_the_limit(client, pilot_user: User):
    from app.security import hash_password

    pilot_user.password_hash = hash_password("the-real-password")
    await pilot_user.save()
    await client.post("/auth/login", json={"email": pilot_user.email, "password": "wrong"})

    resp = await client.post(
        "/auth/login", json={"email": pilot_user.email, "password": "the-real-password"}
    )

    assert resp.status_code == 200


async def test_reset_links_cannot_be_asked_for_endlessly(client, pilot_user: User):
    codes = [
        (
            await client.post(
                "/auth/request-password-reset", json={"email": pilot_user.email}
            )
        ).status_code
        for _ in range(10)
    ]

    assert 429 in codes


async def test_invite_tokens_cannot_be_guessed_at_speed(client):
    codes = [
        (
            await client.post(
                "/auth/accept-invite", json={"token": f"guess-{i}", "password": "long-enough"}
            )
        ).status_code
        for i in range(12)
    ]

    assert 429 in codes
