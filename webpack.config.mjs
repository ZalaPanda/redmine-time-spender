import { resolve } from 'path';
import CopyPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';

export default (_env, argv) => [{
    entry: {
        popup: './src/popup.ts',
        options: './src/options.ts',
        background: './src/background.ts'
    },
    output: {
        path: resolve('dist'),
        filename: '[name].js'
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.json'],
    },
    plugins: [
        new CopyPlugin({ patterns: ['static'] }),
        new HtmlWebpackPlugin({ filename: 'popup.html', chunks: ['popup'], title: 'Redmine Time Spender', scriptLoading: 'module' }),
        new HtmlWebpackPlugin({ filename: 'options.html', chunks: ['options'], title: 'Redmine Time Spender - Options', scriptLoading: 'module' })
    ],
    module: {
        rules: [
            {
                exclude: /node_modules/,
                test: /\.tsx?$/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            '@babel/preset-env',
                            '@babel/preset-typescript',
                            ['@babel/preset-react', { runtime: 'automatic', importSource: '@emotion/react' }]
                        ],
                        plugins: [
                            '@emotion/babel-plugin',
                            '@babel/plugin-transform-runtime',
                            'polished'
                        ]
                    }
                }
            },
        ]
    },
    devtool: argv.mode === 'development' ? 'inline-source-map' : false,
    cache: argv.mode === 'development' ? { type: 'filesystem' } : false,
    optimization: { splitChunks: { chunks: 'all' } }
}];