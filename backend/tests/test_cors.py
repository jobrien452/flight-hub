async def test_allows_the_configured_dev_origin(client):
    resp = await client.options(
        "/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert resp.headers["access-control-allow-origin"] == "http://localhost:5173"


async def test_rejects_an_unlisted_origin(client):
    resp = await client.options(
        "/auth/login",
        headers={
            "Origin": "http://evil.example",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in resp.headers
