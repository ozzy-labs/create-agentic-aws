"""AWS Glue ETL job template.

This PySpark script reads data from an S3 source, applies transformations,
and writes the result to an S3 target location.
"""

import sys

from awsglue.context import GlueContext
from awsglue.job import Job
from awsglue.transforms import ApplyMapping
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext

# Initialize Glue context
args = getResolvedOptions(sys.argv, ["JOB_NAME"])
sc = SparkContext()
glue_context = GlueContext(sc)
spark = glue_context.spark_session
job = Job(glue_context)
job.init(args["JOB_NAME"], args)

# Read from Glue Data Catalog
source_frame = glue_context.create_dynamic_frame.from_catalog(
    database="{{projectName}}_db",
    table_name="source_table",
    transformation_ctx="source",
)

# Apply column mapping / transformation
mapped_frame = ApplyMapping.apply(
    frame=source_frame,
    mappings=[
        ("id", "string", "id", "string"),
        ("name", "string", "name", "string"),
        ("timestamp", "string", "event_time", "timestamp"),
    ],
    transformation_ctx="mapped",
)

# Write to S3 target
glue_context.write_dynamic_frame.from_options(
    frame=mapped_frame,
    connection_type="s3",
    connection_options={"path": "s3://TARGET_BUCKET/output/"},
    format="parquet",
    transformation_ctx="sink",
)

job.commit()
