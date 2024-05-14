from io import BytesIO
import importlib.metadata
import pathlib

import anywidget
import traitlets
import pandas as pd
import pyarrow as pa

try:
    __version__ = importlib.metadata.version("eigen_tour")
except importlib.metadata.PackageNotFoundError:
    __version__ = "unknown"


def arrow_from_pandas(df):
    table = pa.Table.from_pandas(df)
    with BytesIO() as stream:
        writer = pa.ipc.new_file(stream, table.schema)
        writer.write_table(table)
        writer.close()
        return stream.getvalue()


class Widget(anywidget.AnyWidget):
    _esm = pathlib.Path(__file__).parent / "static" / "widget.js"
    _css = pathlib.Path(__file__).parent / "static" / "widget.css"
    data = traitlets.Bytes().tag(sync=True)
    axis_fields = traitlets.List().tag(sync=True)
    label_field = traitlets.Unicode().tag(sync=True)
    label_colors = traitlets.Dict().tag(sync=True)

    def __init__(self, df, axis_fields, label_field, label_colors, **kwargs):

        if not all(field in df.columns for field in axis_fields):
            raise ValueError("`axis_fields` must be a subset of df columns")

        if label_field not in df.columns:
            raise ValueError("`label_field` must be a column in df")

        if not isinstance(df[label_field].dtype, pd.CategoricalDtype):
            df[label_field] = df[label_field].astype("category")

        label_cat = df[label_field].cat.categories
        if isinstance(label_colors, dict):
            for cat in label_cat:
                if cat not in label_colors:
                    raise ValueError(
                        "`label_field` categories must be keys in `label_colors` dict"
                    )
        elif isinstance(label_colors, list):
            label_colors = dict(zip(label_cat, label_colors))
        else:
            raise ValueError("`label_colors` must be a list or a dict")

        super().__init__(
            data=arrow_from_pandas(df[[label_field, *axis_fields]]),
            axis_fields=axis_fields,
            label_field=label_field,
            label_colors=label_colors,
            **kwargs,
        )
