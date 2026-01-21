-module(gun_ffi_helpers).
-export([connect/3, send_text/2, receive_frame/2, close/1]).

%% Connect to a WebSocket server
%% Returns {ok, Connection} or {error, Reason}
connect(Host, Port, Path) ->
    HostList = unicode:characters_to_list(Host),
    PathBinary = unicode:characters_to_binary(Path),

    case gun:open(HostList, Port) of
        {ok, ConnPid} ->
            case gun:await_up(ConnPid, 5000) of
                {ok, _Protocol} ->
                    StreamRef = gun:ws_upgrade(ConnPid, PathBinary),
                    case await_ws_upgrade(ConnPid, StreamRef, 5000) of
                        ok ->
                            {ok, {ConnPid, StreamRef}};
                        {error, Reason} ->
                            gun:close(ConnPid),
                            {error, Reason}
                    end;
                {error, Reason} ->
                    gun:close(ConnPid),
                    {error, format_error(Reason)}
            end;
        {error, Reason} ->
            {error, format_error(Reason)}
    end.

%% Wait for WebSocket upgrade to complete
await_ws_upgrade(ConnPid, StreamRef, Timeout) ->
    receive
        {gun_upgrade, ConnPid, StreamRef, [<<"websocket">>], _Headers} ->
            ok;
        {gun_response, ConnPid, _, _, Status, _Headers} ->
            {error, <<"WebSocket upgrade failed with status: ", (integer_to_binary(Status))/binary>>};
        {gun_error, ConnPid, StreamRef, Reason} ->
            {error, format_error(Reason)}
    after Timeout ->
        {error, <<"WebSocket upgrade timeout">>}
    end.

%% Send a text frame
send_text({ConnPid, StreamRef}, Text) ->
    TextBinary = unicode:characters_to_binary(Text),
    gun:ws_send(ConnPid, StreamRef, {text, TextBinary}),
    {ok, nil}.

%% Receive a WebSocket frame (blocking with timeout)
receive_frame({ConnPid, _StreamRef}, Timeout) ->
    receive
        {gun_ws, ConnPid, _Ref, {text, Text}} ->
            {ok, {text_frame, Text}};
        {gun_ws, ConnPid, _Ref, {binary, Data}} ->
            {ok, {binary_frame, Data}};
        {gun_ws, ConnPid, _Ref, {close, Code, Reason}} ->
            {ok, {close_frame, Code, Reason}};
        {gun_ws, ConnPid, _Ref, close} ->
            {ok, {close_frame, 1000, <<>>}};
        {gun_ws, ConnPid, _Ref, ping} ->
            {ok, {ping_frame, <<>>}};
        {gun_ws, ConnPid, _Ref, {ping, Data}} ->
            {ok, {ping_frame, Data}};
        {gun_ws, ConnPid, _Ref, pong} ->
            {ok, {pong_frame, <<>>}};
        {gun_ws, ConnPid, _Ref, {pong, Data}} ->
            {ok, {pong_frame, Data}};
        {gun_down, ConnPid, _, Reason, _} ->
            {error, format_error(Reason)};
        {gun_error, ConnPid, _Ref, Reason} ->
            {error, format_error(Reason)}
    after Timeout ->
        {error, <<"timeout">>}
    end.

%% Close connection
close({ConnPid, _StreamRef}) ->
    gun:close(ConnPid),
    nil.

%% Format error to binary string
format_error(Reason) when is_atom(Reason) ->
    atom_to_binary(Reason, utf8);
format_error(Reason) when is_binary(Reason) ->
    Reason;
format_error(Reason) when is_list(Reason) ->
    unicode:characters_to_binary(Reason);
format_error(Reason) ->
    unicode:characters_to_binary(io_lib:format("~p", [Reason])).
