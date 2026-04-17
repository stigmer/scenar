from ai.scenar.commons.rpc import pagination_pb2 as _pagination_pb2
from ai.scenar.scenario.v1 import api_pb2 as _api_pb2
from buf.validate import validate_pb2 as _validate_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class ScenarioOutputFormat(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    output_format_unspecified: _ClassVar[ScenarioOutputFormat]
    interactive_embed: _ClassVar[ScenarioOutputFormat]
    mp4_video: _ClassVar[ScenarioOutputFormat]
output_format_unspecified: ScenarioOutputFormat
interactive_embed: ScenarioOutputFormat
mp4_video: ScenarioOutputFormat

class ScenarioId(_message.Message):
    __slots__ = ("value",)
    VALUE_FIELD_NUMBER: _ClassVar[int]
    value: str
    def __init__(self, value: _Optional[str] = ...) -> None: ...

class Scenarios(_message.Message):
    __slots__ = ("entries",)
    ENTRIES_FIELD_NUMBER: _ClassVar[int]
    entries: _containers.RepeatedCompositeFieldContainer[_api_pb2.Scenario]
    def __init__(self, entries: _Optional[_Iterable[_Union[_api_pb2.Scenario, _Mapping]]] = ...) -> None: ...

class ListScenariosInput(_message.Message):
    __slots__ = ("tags", "page")
    TAGS_FIELD_NUMBER: _ClassVar[int]
    PAGE_FIELD_NUMBER: _ClassVar[int]
    tags: _containers.RepeatedScalarFieldContainer[str]
    page: _pagination_pb2.PageInfo
    def __init__(self, tags: _Optional[_Iterable[str]] = ..., page: _Optional[_Union[_pagination_pb2.PageInfo, _Mapping]] = ...) -> None: ...

class RenderInput(_message.Message):
    __slots__ = ("scenario_id", "format")
    SCENARIO_ID_FIELD_NUMBER: _ClassVar[int]
    FORMAT_FIELD_NUMBER: _ClassVar[int]
    scenario_id: str
    format: ScenarioOutputFormat
    def __init__(self, scenario_id: _Optional[str] = ..., format: _Optional[_Union[ScenarioOutputFormat, str]] = ...) -> None: ...

class RenderOutput(_message.Message):
    __slots__ = ("artifact_url", "format")
    ARTIFACT_URL_FIELD_NUMBER: _ClassVar[int]
    FORMAT_FIELD_NUMBER: _ClassVar[int]
    artifact_url: str
    format: ScenarioOutputFormat
    def __init__(self, artifact_url: _Optional[str] = ..., format: _Optional[_Union[ScenarioOutputFormat, str]] = ...) -> None: ...
