# eigen-tour

visualizing (normalized) eigenvectors with the [Grand Tour](https://doi.org/10.1137/0906011)

## development

Create a python dev envrionment

```sh
hatch shell
```

Run the JavaScript development server:
```
pnpm install
pnpm dev
```

Open JupyterLab:

```sh
ANYWIDGET_HMR=1 juptyer lab
```

## data

Preparing a dataset for the visualization requires serializing a table to [Arrow IPC Format](https://arrow.apache.org/docs/python/ipc.html).

## related

- [The Grand Tour: A Tool for Viewing Multidimensional Data](https://doi.org/10.1137/0906011)
- [Visualizing Neural Networks with the Grand Tour](https://doi.org/10.23915/distill.00025)
